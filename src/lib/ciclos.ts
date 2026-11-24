import { Ciclo } from '@/types';

export function ordenarCiclos(ciclos: Ciclo[]): Ciclo[] {
  return [...ciclos].sort((a, b) => b.numeroCiclo - a.numeroCiclo || b.intento - a.intento);
}

// Si el último intento no preñó, se repite el mismo ciclo con el intento siguiente
// (en el cuaderno: 2(2) = ciclo 2, segundo intento). Si no, empieza un ciclo nuevo.
export function siguienteCiclo(ciclosMadre: Ciclo[]): { numeroCiclo: number; intento: number } {
  const ultimo = ordenarCiclos(ciclosMadre)[0];
  if (!ultimo) return { numeroCiclo: 1, intento: 1 };
  if (ultimo.estadoCiclo === 'fallido') return { numeroCiclo: ultimo.numeroCiclo, intento: ultimo.intento + 1 };
  return { numeroCiclo: ultimo.numeroCiclo + 1, intento: 1 };
}

export const textoCiclo = (ciclo: Pick<Ciclo, 'numeroCiclo' | 'intento'>) =>
  `Ciclo #${ciclo.numeroCiclo} · ${ciclo.intento}° intento`;
