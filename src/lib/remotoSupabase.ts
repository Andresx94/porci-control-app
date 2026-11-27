// Supabase como Remoto, más sesión y granjas. Solo se usa si hayNube().
import { supabase } from '@/lib/supabase';
import { ErrorRed, Fila, Remoto, ResultadoFila } from '@/lib/sincronizacion';
import { accesoVigente } from '@/lib/invitaciones';
import { TablaNube, guardarPreferencia, leerPreferencia } from '@/lib/datos';

interface ErrorPostgrest {
  message: string;
  code?: string;
  status?: number;
}

function cliente() {
  if (!supabase) throw new Error('La nube no está configurada');
  return supabase;
}

const sinConexion = (e: ErrorPostgrest) =>
  (!e.code && /fetch|network|load failed|timeout/i.test(e.message)) || (typeof navigator !== 'undefined' && !navigator.onLine);

// Errores de datos o permisos de una fila (unicidad, RLS, checks, triggers).
const esErrorDeFila = (e: ErrorPostgrest) => !!e.code && /^(23|22|42501|P0001)/.test(e.code);

// Convierte un error de supabase: red -> ErrorRed; otros -> Error.
function lanzar(e: ErrorPostgrest): never {
  if (sinConexion(e)) throw new ErrorRed(e.message);
  throw new Error(e.message);
}

async function subirFilas(tabla: TablaNube, filas: Fila[]): Promise<ResultadoFila[]> {
  const db = cliente();
  const lote = await db.from(tabla).upsert(filas, { onConflict: 'id' });
  if (!lote.error) return filas.map(f => ({ id: f.id as string }));
  if (sinConexion(lote.error)) lanzar(lote.error);

  // Falló el lote: fila por fila para saber cuál chocó.
  const resultados: ResultadoFila[] = [];
  for (const f of filas) {
    const { error } = await db.from(tabla).upsert(f, { onConflict: 'id' });
    if (!error) resultados.push({ id: f.id as string });
    else if (esErrorDeFila(error)) resultados.push({ id: f.id as string, error: error.message });
    else lanzar(error); // sesión vencida, servidor caído, etc.: no es culpa de la fila
  }
  return resultados;
}

const TAMANO_PAGINA = 1000;

async function bajarFilas(tabla: TablaNube, granjaId: string, desde: string | null): Promise<Fila[]> {
  const db = cliente();
  const todas: Fila[] = [];
  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    let consulta = db.from(tabla).select('*').eq('granja_id', granjaId);
    if (desde) consulta = consulta.gte('actualizado_en', desde);
    const { data, error } = await consulta
      .order('actualizado_en', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, inicio + TAMANO_PAGINA - 1);
    if (error) lanzar(error);
    todas.push(...((data ?? []) as Fila[]));
    if (!data || data.length < TAMANO_PAGINA) return todas;
  }
}

export const remotoSupabase: Remoto = { subir: subirFilas, bajar: bajarFilas };

// ---------------------------------------------------------------- sesión
function mensajeLegible(e: ErrorPostgrest & { name?: string }): string {
  if (/invalid login credentials/i.test(e.message)) return 'Correo o contraseña incorrectos';
  if (/email not confirmed/i.test(e.message)) return 'El correo aún no está confirmado';
  if (/fetch|network|load failed/i.test(e.message) || e.name === 'AuthRetryableFetchError') {
    return 'Sin conexión. Intenta de nuevo con internet';
  }
  return 'No se pudo iniciar sesión';
}

export async function iniciarSesion(email: string, password: string): Promise<void> {
  const { error } = await cliente().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(mensajeLegible(error));
}

export async function cerrarSesion(): Promise<void> {
  await cliente().auth.signOut();
}

// Lee la sesión guardada en el dispositivo (no necesita red).
export interface UsuarioNube {
  id: string;
  email: string;
  // Los trabajadores entran con sesión anónima (sin correo).
  anonimo: boolean;
}

export async function usuarioActual(): Promise<UsuarioNube | null> {
  const { data } = await cliente().auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? '', anonimo: !!u.is_anonymous } : null;
}

export interface GranjaUsuario {
  id: string;
  nombre: string;
  rol: string;
  // Fin del acceso del trabajador (null = no vence).
  venceEn: string | null;
}

export async function granjasDelUsuario(): Promise<GranjaUsuario[]> {
  const usuario = await usuarioActual();
  if (!usuario) return [];
  // RLS deja ver a todos los miembros de mis granjas; aquí solo interesan mis filas.
  const { data, error } = await cliente()
    .from('miembros')
    .select('rol, vence_en, granjas(id, nombre, borrado_en)')
    .eq('usuario_id', usuario.id)
    .is('borrado_en', null);
  if (error) lanzar(error);
  const filas = (data ?? []) as unknown as {
    rol: string;
    vence_en: string | null;
    granjas: { id: string; nombre: string; borrado_en: string | null } | null;
  }[];
  return filas
    .filter(f => f.granjas && !f.granjas.borrado_en && accesoVigente(f.vence_en))
    .map(f => ({ id: f.granjas!.id, nombre: f.granjas!.nombre, rol: f.rol, venceEn: f.vence_en }));
}

// ---------------------------------------------------------------- granja elegida
const PREF_GRANJA = 'granja_actual';

export const granjaElegida = (): string | null => leerPreferencia(PREF_GRANJA);
export const elegirGranjaGuardada = (id: string) => guardarPreferencia(PREF_GRANJA, id);

// La elegida si sigue disponible; si solo hay una, esa.
export function resolverGranja(granjas: GranjaUsuario[], elegida: string | null): string | null {
  if (elegida && granjas.some(g => g.id === elegida)) return elegida;
  return granjas.length === 1 ? granjas[0].id : null;
}
