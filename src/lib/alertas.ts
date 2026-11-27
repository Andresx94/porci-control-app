import { Alerta, Ciclo, Madre } from '@/types';
import { DIAS_PROXIMO_PARTO, diasEntre, sumarDias } from '@/lib/fechas';

export const DIAS_LISTA_CRUCE = 7;

const ESTADOS_ACTIVOS = ['cruce', 'gestacion', 'parto', 'lactancia'];

function plural(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}

// Calcula las alertas que corresponden hoy. Función pura: no toca datos ni reloj.
// Cada alerta tiene un id estable (tipo + ciclo), así un ciclo nuevo genera las suyas
// y una alerta leída conserva `leida` mientras siga vigente con la misma fecha.
export function calcularAlertas(
  madres: Madre[],
  ciclos: Ciclo[],
  existentes: Alerta[],
  hoy: string,
): Alerta[] {
  const madrePorId = new Map(madres.map(m => [m.id, m]));
  const limite = sumarDias(hoy, DIAS_PROXIMO_PARTO);
  const nuevas: Alerta[] = [];

  for (const ciclo of ciclos) {
    const madre = madrePorId.get(ciclo.madreId);
    if (!madre || madre.estado === 'descartada') continue;

    if (ciclo.estadoCiclo === 'gestacion' && ciclo.fechaPartoPrevista) {
      const fecha = ciclo.fechaPartoPrevista;
      if (fecha < hoy) {
        const atraso = diasEntre(fecha, hoy);
        nuevas.push({
          id: `parto_atrasado:${ciclo.id}`,
          tipo: 'parto_proximo',
          madreId: madre.id,
          mensaje: `${madre.arete}: parto atrasado ${plural(atraso)}`,
          fechaAlerta: fecha,
          prioridad: 'alta',
          leida: false,
        });
      } else if (fecha <= limite) {
        nuevas.push({
          id: `parto_proximo:${ciclo.id}`,
          tipo: 'parto_proximo',
          madreId: madre.id,
          mensaje: `${madre.arete} próxima a parir`,
          fechaAlerta: fecha,
          prioridad: 'alta',
          leida: false,
        });
      }
    }

    if (ciclo.estadoCiclo === 'lactancia' && ciclo.fechaDestetePrevista) {
      const fecha = ciclo.fechaDestetePrevista;
      if (fecha <= limite) {
        const atraso = diasEntre(fecha, hoy);
        nuevas.push({
          id: `destete_pendiente:${ciclo.id}`,
          tipo: 'destete_pendiente',
          madreId: madre.id,
          mensaje: atraso > 0
            ? `${madre.arete}: destete atrasado ${plural(atraso)}`
            : `${madre.arete} lista para destete`,
          fechaAlerta: fecha,
          prioridad: 'media',
          leida: false,
        });
      }
    }
  }

  // Madres vacías listas para un nuevo cruce: sin ciclo activo y con el último
  // ciclo finalizado hace al menos DIAS_LISTA_CRUCE días desde el destete.
  for (const madre of madres) {
    if (madre.estado !== 'vacia') continue;
    const propios = ciclos.filter(c => c.madreId === madre.id);
    if (propios.some(c => ESTADOS_ACTIVOS.includes(c.estadoCiclo))) continue;
    const fechaCierre = (c: Ciclo) =>
      c.estadoCiclo === 'fallido' ? (c.fechaFallo || c.fechaCruce) : c.fechaDestete;
    const ultimo = propios
      .filter(c => (c.estadoCiclo === 'finalizado' && c.fechaDestete) || c.estadoCiclo === 'fallido')
      .sort((a, b) => (fechaCierre(b) || '').localeCompare(fechaCierre(a) || '')
        || (a.estadoCiclo === 'fallido' ? 1 : 0) - (b.estadoCiclo === 'fallido' ? 1 : 0))[0];
    if (!ultimo) continue;
    if (ultimo.estadoCiclo === 'fallido') {
      nuevas.push({
        id: `lista_cruce:${ultimo.id}`,
        tipo: 'lista_cruce',
        madreId: madre.id,
        mensaje: `${madre.arete}: lista para volver a cruzar`,
        fechaAlerta: fechaCierre(ultimo)!,
        prioridad: 'media',
        leida: false,
      });
      continue;
    }
    if (!ultimo.fechaDestete) continue;
    if (diasEntre(ultimo.fechaDestete, hoy) < DIAS_LISTA_CRUCE) continue;
    nuevas.push({
      id: `lista_cruce:${ultimo.id}`,
      tipo: 'lista_cruce',
      madreId: madre.id,
      mensaje: `${madre.arete} lista para nuevo cruce`,
      fechaAlerta: sumarDias(ultimo.fechaDestete, DIAS_LISTA_CRUCE),
      prioridad: 'baja',
      leida: false,
    });
  }

  const previas = new Map(existentes.map(a => [a.id, a]));
  return nuevas.map(a => {
    const previa = previas.get(a.id);
    return previa?.leida && previa.fechaAlerta === a.fechaAlerta ? { ...a, leida: true } : a;
  });
}

export function alertasIguales(a: Alerta[], b: Alerta[]): boolean {
  return a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));
}
