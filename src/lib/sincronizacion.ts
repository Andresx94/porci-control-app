// Sincronización con la nube: lógica pura, sin importar supabase.
// Todo acceso a localStorage pasa por datos.ts.
import { Ciclo, Madre, MotivoFallo, EstadoCiclo, EstadoMadre, TipoCruce } from '@/types';
import {
  agregarConflicto,
  CursorNube,
  esDemo,
  escribirListaSinEncolar,
  guardarCursor,
  hayDatosLocalesNube,
  leerCola,
  leerGranjaDeDatos,
  marcarGranjaDeDatos,
  leerCursor,
  leerListaTabla,
  quitarDeCola,
  TablaNube,
} from '@/lib/datos';

export type Fila = Record<string, unknown>;

export interface ResultadoFila {
  id: string;
  error?: string;
}

// Lo que la nube debe saber hacer; en las pruebas se reemplaza por uno en memoria.
export interface Remoto {
  // Upsert por id. Devuelve un resultado por fila; lanza si falla la red.
  subir(tabla: TablaNube, filas: Fila[]): Promise<ResultadoFila[]>;
  // Filas con actualizado_en >= desde (incluidas las borradas), ordenadas por actualizado_en.
  bajar(tabla: TablaNube, granjaId: string, desde: string | null): Promise<Fila[]>;
}

// Error de conexión: la cola no se toca y se reintenta luego.
export class ErrorRed extends Error {}

export interface ResultadoSync {
  subidas: number;
  bajadas: number;
  conflictos: number;
  cambiosLocales: boolean;
}

const MARGEN_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------- mapeo
const nulo = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

const texto = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

const numero = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

// Instante de la nube (con microsegundos y +00:00) a ISO estándar.
const instante = (v: unknown): string | undefined => {
  const t = texto(v);
  if (!t) return undefined;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? t : new Date(ms).toISOString();
};

const sinUndefined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export function madreANube(m: Madre, granjaId: string): Fila {
  return {
    id: m.id,
    granja_id: granjaId,
    arete: m.arete,
    fecha_nacimiento: nulo(m.fechaNacimiento),
    estado: m.estado,
    observaciones: nulo(m.observaciones),
    fecha_registro: m.fechaRegistro,
    registrado_en: nulo(m.registradoEn),
    fecha_descarte: nulo(m.fechaDescarte),
    descartado_en: nulo(m.descartadoEn),
    motivo_descarte: nulo(m.motivoDescarte),
    arete_madre: nulo(m.areteMadre),
    arete_padre: nulo(m.aretePadre),
    // Solo se usa al insertar; el servidor conserva el original al actualizar.
    creado_en: nulo(m.registradoEn),
  };
}

export function madreDeNube(f: Fila): Madre {
  return sinUndefined({
    id: f.id as string,
    arete: f.arete as string,
    fechaNacimiento: texto(f.fecha_nacimiento),
    estado: f.estado as EstadoMadre,
    observaciones: texto(f.observaciones),
    fechaRegistro: f.fecha_registro as string,
    registradoEn: instante(f.registrado_en),
    fechaDescarte: texto(f.fecha_descarte),
    descartadoEn: instante(f.descartado_en),
    motivoDescarte: texto(f.motivo_descarte),
    areteMadre: texto(f.arete_madre),
    aretePadre: texto(f.arete_padre),
  });
}

export function cicloANube(c: Ciclo, granjaId: string): Fila {
  return {
    id: c.id,
    granja_id: granjaId,
    madre_id: c.madreId,
    numero_ciclo: c.numeroCiclo,
    intento: c.intento,
    fecha_cruce: c.fechaCruce,
    tipo_cruce: c.tipoCruce,
    numero_verraco: nulo(c.numeroVerraco),
    observaciones_cruce: nulo(c.observacionesCruce),
    fecha_parto_prevista: nulo(c.fechaPartoPrevista),
    fecha_vacuna_suicen: nulo(c.fechaVacunaSuicen),
    fecha_enjaule: nulo(c.fechaEnjaule),
    fecha_destete_prevista: nulo(c.fechaDestetePrevista),
    fecha_siguiente_monta: nulo(c.fechaSiguienteMonta),
    fecha_parto_real: nulo(c.fechaPartoReal),
    nacidos_totales: nulo(c.nacidosTotales),
    nacidos_vivos: nulo(c.nacidosVivos),
    nacidos_muertos: nulo(c.nacidosMuertos),
    momias: nulo(c.momias),
    observaciones_parto: nulo(c.observacionesParto),
    fecha_destete: nulo(c.fechaDestete),
    destetados: nulo(c.destetados),
    muertes_lactancia: nulo(c.muertesLactancia),
    peso_promedio_nacimiento: nulo(c.pesoPromedioNacimiento),
    peso_promedio_destete: nulo(c.pesoPromedioDestete),
    observaciones_destete: nulo(c.observacionesDestete),
    fecha_fallo: nulo(c.fechaFallo),
    motivo_fallo: nulo(c.motivoFallo),
    observaciones_fallo: nulo(c.observacionesFallo),
    estado_ciclo: c.estadoCiclo,
    creado_en: c.fechaCreacion,
    // fechaActualizacion es local; actualizado_en lo pone el servidor.
  };
}

export function cicloDeNube(f: Fila): Ciclo {
  return sinUndefined({
    id: f.id as string,
    madreId: f.madre_id as string,
    numeroCiclo: numero(f.numero_ciclo) as number,
    intento: numero(f.intento) as number,
    fechaCruce: f.fecha_cruce as string,
    tipoCruce: f.tipo_cruce as TipoCruce,
    numeroVerraco: texto(f.numero_verraco),
    observacionesCruce: texto(f.observaciones_cruce),
    fechaPartoPrevista: texto(f.fecha_parto_prevista),
    fechaVacunaSuicen: texto(f.fecha_vacuna_suicen),
    fechaEnjaule: texto(f.fecha_enjaule),
    fechaDestetePrevista: texto(f.fecha_destete_prevista),
    fechaSiguienteMonta: texto(f.fecha_siguiente_monta),
    fechaPartoReal: texto(f.fecha_parto_real),
    nacidosTotales: numero(f.nacidos_totales),
    nacidosVivos: numero(f.nacidos_vivos),
    nacidosMuertos: numero(f.nacidos_muertos),
    momias: numero(f.momias),
    observacionesParto: texto(f.observaciones_parto),
    fechaDestete: texto(f.fecha_destete),
    destetados: numero(f.destetados),
    muertesLactancia: numero(f.muertes_lactancia),
    pesoPromedioNacimiento: numero(f.peso_promedio_nacimiento),
    pesoPromedioDestete: numero(f.peso_promedio_destete),
    observacionesDestete: texto(f.observaciones_destete),
    fechaFallo: texto(f.fecha_fallo),
    motivoFallo: texto(f.motivo_fallo) as MotivoFallo | undefined,
    observacionesFallo: texto(f.observaciones_fallo),
    estadoCiclo: f.estado_ciclo as EstadoCiclo,
    fechaCreacion: instante(f.creado_en) as string,
    fechaActualizacion: instante(f.actualizado_en) as string,
  });
}

// ---------------------------------------------------------------- utilidades
// JSON con claves ordenadas, para comparar sin depender del orden.
function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
}

const mayorInstante = (a: string | undefined, b: string): string =>
  a && Date.parse(a) >= Date.parse(b) ? a : b;

const restarMargen = (iso: string): string => new Date(Date.parse(iso) - MARGEN_MS).toISOString();

const TABLAS: TablaNube[] = ['madres', 'ciclos']; // madres primero por la FK de ciclos

type Registro = { id: string };

const aNube = (tabla: TablaNube, reg: Registro, granjaId: string): Fila =>
  tabla === 'madres' ? madreANube(reg as Madre, granjaId) : cicloANube(reg as Ciclo, granjaId);

const deNube = (tabla: TablaNube, fila: Fila): Registro =>
  tabla === 'madres' ? madreDeNube(fila) : cicloDeNube(fila);

// ---------------------------------------------------------------- sincronizar
async function subirPendientes(remoto: Remoto, granjaId: string, res: ResultadoSync) {
  for (const tabla of TABLAS) {
    const lista = leerListaTabla<Registro>(tabla);
    const fotos = new Map<string, string>(); // id -> versión local que se sube
    const filas: Fila[] = [];

    for (const id of leerCola()[tabla]) {
      const reg = lista.find(x => x.id === id);
      if (!reg) {
        quitarDeCola(tabla, id); // ya no existe localmente
        continue;
      }
      fotos.set(id, estable(reg));
      filas.push(aNube(tabla, reg, granjaId));
    }
    if (!filas.length) continue;

    const resultados = await remoto.subir(tabla, filas); // si lanza, la cola queda intacta

    const actual = leerListaTabla<Registro>(tabla);
    for (const r of resultados) {
      const ahora = actual.find(x => x.id === r.id);
      // Si cambió mientras subía, sigue en cola para la próxima vuelta.
      if (ahora && estable(ahora) !== fotos.get(r.id)) continue;
      quitarDeCola(tabla, r.id);
      if (r.error) {
        agregarConflicto({ tabla, id: r.id, error: r.error, fecha: new Date().toISOString() });
        res.conflictos++;
      } else {
        res.subidas++;
      }
    }
  }
}

async function bajarCambios(remoto: Remoto, granjaId: string, res: ResultadoSync) {
  const cursor: CursorNube = { ...leerCursor(granjaId) };

  for (const tabla of TABLAS) {
    const desde = cursor[tabla] ? restarMargen(cursor[tabla] as string) : null;
    const filas = await remoto.bajar(tabla, granjaId, desde);
    if (!filas.length) continue;

    // Se lee lo local después de la espera de red, por si cambió mientras tanto.
    const pendientes = new Set(leerCola()[tabla]);
    let lista = leerListaTabla<Registro>(tabla);
    let cambio = false;
    let maximo = cursor[tabla];

    for (const fila of filas) {
      const id = fila.id as string;
      maximo = mayorInstante(maximo, fila.actualizado_en as string);
      if (pendientes.has(id)) continue; // lo local pendiente no se pisa

      const idx = lista.findIndex(x => x.id === id);
      if (fila.borrado_en) {
        if (idx >= 0) {
          lista = lista.filter(x => x.id !== id);
          cambio = true;
          res.bajadas++;
        }
        continue;
      }
      const nuevo = deNube(tabla, fila);
      if (idx < 0) {
        lista = [...lista, nuevo];
      } else if (estable(lista[idx]) !== estable(nuevo)) {
        lista = lista.map((x, i) => (i === idx ? nuevo : x));
      } else {
        continue;
      }
      cambio = true;
      res.bajadas++;
    }

    if (cambio) {
      escribirListaSinEncolar(tabla, lista);
      res.cambiosLocales = true;
    }
    cursor[tabla] = maximo;
    guardarCursor(granjaId, cursor);
  }
}

// Lanza si falla la red o la sesión; los errores de fila quedan como conflictos.
export async function sincronizar(remoto: Remoto, granjaId: string): Promise<ResultadoSync> {
  const res: ResultadoSync = { subidas: 0, bajadas: 0, conflictos: 0, cambiosLocales: false };
  if (esDemo()) return res; // la demo nunca sincroniza
  // Los datos de este teléfono son de una sola granja: no se mezclan con otra.
  const duena = leerGranjaDeDatos();
  if (duena && duena !== granjaId && hayDatosLocalesNube()) {
    throw new Error('Los datos de este teléfono son de otra granja');
  }
  marcarGranjaDeDatos(granjaId);
  await subirPendientes(remoto, granjaId, res);
  await bajarCambios(remoto, granjaId, res);
  return res;
}
