import { Ciclo } from '@/types';

export const DIAS_PROXIMO_PARTO = 7;

// Una fecha de calendario es el texto 'AAAA-MM-DD': no tiene hora ni zona, así que
// se ve igual en cualquier dispositivo o servidor. Se compara como texto y se calcula
// en UTC para que los cambios de horario no muevan el día.
const FECHA_PURA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MEDIANOCHE_UTC = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.0+)?Z$/;

export function esFechaPura(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const partes = FECHA_PURA.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// El día del calendario local en que ocurrió un instante.
export function diaLocal(instante: Date): string {
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${String(instante.getFullYear()).padStart(4, '0')}-${mes}-${dia}`;
}

export function hoyISO(): string {
  return diaLocal(new Date());
}

// Convierte valores antiguos a fecha pura. Devuelve undefined si no se puede leer.
export function aFechaPura(valor: unknown): string | undefined {
  if (esFechaPura(valor)) return valor;
  if (typeof valor !== 'string') return undefined;
  const medianoche = MEDIANOCHE_UTC.exec(valor);
  if (medianoche && esFechaPura(medianoche[1])) return medianoche[1];
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? undefined : diaLocal(instante);
}

export function formatFecha(fecha?: string): string {
  const pura = aFechaPura(fecha);
  if (!pura) return '—';
  const [anio, mes, dia] = pura.split('-').map(Number);
  return `${dia}/${mes}/${anio}`;
}

function aDiasUTC(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date((aDiasUTC(fecha) + dias) * 86_400_000).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return aDiasUTC(hasta) - aDiasUTC(desde);
}

export function calcularFechasCiclo(fechaCruce: string) {
  const fechaPartoPrevista = sumarDias(fechaCruce, 115);
  const fechaDestetePrevista = sumarDias(fechaPartoPrevista, 30);
  return {
    fechaPartoPrevista,
    fechaVacunaSuicen: sumarDias(fechaPartoPrevista, -15),
    fechaEnjaule: sumarDias(fechaPartoPrevista, -5),
    fechaDestetePrevista,
    fechaSiguienteMonta: sumarDias(fechaDestetePrevista, 5),
  };
}

// Gestando con parto previsto en los próximos 7 días, o ya vencido sin registrar.
export function esProximaAParir(ciclo: Ciclo): boolean {
  return ciclo.estadoCiclo === 'gestacion'
    && !!ciclo.fechaPartoPrevista
    && ciclo.fechaPartoPrevista <= sumarDias(hoyISO(), DIAS_PROXIMO_PARTO);
}

// Orden natural: 2 antes que 10, y A2 antes que A10.
export function compararAretes(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}
