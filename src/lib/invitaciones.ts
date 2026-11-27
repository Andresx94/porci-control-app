// Lógica pura de las invitaciones de trabajadores (sin Supabase).
export const DIAS_ACCESO = [30, 45, 60] as const;
export type DiasAcceso = (typeof DIAS_ACCESO)[number];

export const DIAS_VALIDEZ_ENLACE = 7;
const MS_DIA = 86_400_000;

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

// 32 bytes aleatorios en base64url (43 caracteres, sin relleno).
export function generarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binario = '';
  bytes.forEach(b => (binario += String.fromCharCode(b)));
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// sha256 en hexadecimal minúscula (igual a encode(sha256(...), 'hex') en Postgres).
export async function hashToken(token: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(resumen), b => b.toString(16).padStart(2, '0')).join('');
}

export function enlaceInvitacion(origen: string, base: string, token: string): string {
  return `${origen}${base}?invitacion=${token}`;
}

// Token de la URL (`?invitacion=...`) si tiene el formato esperado.
export function tokenDeUrl(search: string): string | null {
  const valor = new URLSearchParams(search).get('invitacion');
  return valor && FORMATO_TOKEN.test(valor) ? valor : null;
}

export const venceEnlace = (ahora: Date): Date => new Date(ahora.getTime() + DIAS_VALIDEZ_ENLACE * MS_DIA);

export const venceAcceso = (ahora: Date, dias: number): Date => new Date(ahora.getTime() + dias * MS_DIA);

// Vigente si no vence (null) o vence en el futuro.
export function accesoVigente(venceEn: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!venceEn) return true;
  const t = Date.parse(venceEn);
  return Number.isNaN(t) ? false : t > ahora.getTime();
}

// Traduce el error del servidor a un mensaje para el trabajador.
export function mensajeCanje(error: unknown): string {
  const m = error instanceof Error ? error.message : '';
  if (/no v[aá]lida|vencida/i.test(m)) return 'El enlace ya fue usado o venció. Pide uno nuevo al dueño';
  if (/ya es due[nñ]o/i.test(m)) return 'Este usuario ya es dueño de la granja';
  if (/anonymous|anónim/i.test(m)) return 'El acceso por enlace no está activado. Avisa al dueño';
  if (/fetch|network|load failed/i.test(m) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'Sin conexión. Intenta de nuevo con internet';
  }
  return 'No se pudo abrir el enlace. Pide uno nuevo al dueño';
}
