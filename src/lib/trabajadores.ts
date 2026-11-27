// Trabajadores e invitaciones: todo el acceso a Supabase de esta función.
import { supabase } from '@/lib/supabase';
import { usuarioActual } from '@/lib/remotoSupabase';
import {
  DiasAcceso,
  enlaceInvitacion,
  generarToken,
  hashToken,
  venceAcceso,
  venceEnlace,
} from '@/lib/invitaciones';

function cliente() {
  if (!supabase) throw new Error('La nube no está configurada');
  return supabase;
}

export interface Trabajador {
  usuarioId: string;
  nombre: string | null;
  venceEn: string | null;
}

export interface InvitacionPendiente {
  id: string;
  nombre: string | null;
  dias: number;
  venceEn: string;
}

// Crea la invitación y devuelve el enlace. El token solo existe en esta respuesta.
export async function crearInvitacion(granjaId: string, nombre: string, dias: DiasAcceso): Promise<string> {
  const usuario = await usuarioActual();
  if (!usuario) throw new Error('Sin sesión');
  const token = generarToken();
  const { error } = await cliente().from('invitaciones').insert({
    granja_id: granjaId,
    token_hash: await hashToken(token),
    nombre: nombre.trim() || null,
    dias,
    creado_por: usuario.id,
    vence_en: venceEnlace(new Date()).toISOString(),
  });
  if (error) throw new Error('No se pudo crear el enlace');
  return enlaceInvitacion(window.location.origin, import.meta.env.BASE_URL, token);
}

export async function listarTrabajadores(granjaId: string): Promise<Trabajador[]> {
  const { data, error } = await cliente()
    .from('miembros')
    .select('usuario_id, nombre, vence_en')
    .eq('granja_id', granjaId)
    .eq('rol', 'operario')
    .is('borrado_en', null)
    .order('creado_en', { ascending: true });
  if (error) throw new Error('No se pudo leer la lista de trabajadores');
  return (data ?? []).map(f => ({ usuarioId: f.usuario_id, nombre: f.nombre, venceEn: f.vence_en }));
}

export async function listarInvitaciones(granjaId: string): Promise<InvitacionPendiente[]> {
  const { data, error } = await cliente()
    .from('invitaciones')
    .select('id, nombre, dias, vence_en')
    .eq('granja_id', granjaId)
    .is('usado_en', null)
    .is('borrado_en', null)
    .gt('vence_en', new Date().toISOString())
    .order('creado_en', { ascending: false });
  if (error) throw new Error('No se pudo leer las invitaciones');
  return (data ?? []).map(f => ({ id: f.id, nombre: f.nombre, dias: f.dias, venceEn: f.vence_en }));
}

// Renovar: el acceso vence dentro de `dias` contando desde hoy.
export async function renovarTrabajador(granjaId: string, usuarioId: string, dias: DiasAcceso): Promise<void> {
  const { data, error } = await cliente()
    .from('miembros')
    .update({ vence_en: venceAcceso(new Date(), dias).toISOString() })
    .eq('granja_id', granjaId)
    .eq('usuario_id', usuarioId)
    .eq('rol', 'operario')
    .select('usuario_id');
  if (error || !data?.length) throw new Error('No se pudo renovar el acceso');
}

export async function quitarTrabajador(granjaId: string, usuarioId: string): Promise<void> {
  const { data, error } = await cliente()
    .from('miembros')
    .update({ borrado_en: new Date().toISOString() })
    .eq('granja_id', granjaId)
    .eq('usuario_id', usuarioId)
    .eq('rol', 'operario')
    .select('usuario_id');
  if (error || !data?.length) throw new Error('No se pudo quitar al trabajador');
}

export async function anularInvitacion(id: string): Promise<void> {
  const { data, error } = await cliente()
    .from('invitaciones')
    .update({ borrado_en: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) throw new Error('No se pudo anular la invitación');
}

// Lado del trabajador: sesión anónima si no hay ninguna, y canje del token.
export async function canjearInvitacion(token: string): Promise<string> {
  const db = cliente();
  const { data: sesion } = await db.auth.getSession();
  if (!sesion.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await db.rpc('canjear_invitacion', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}
