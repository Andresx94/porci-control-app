import { Alerta, Ciclo, Madre, TipoCruce } from '@/types';
import { calcularFechasCiclo, sumarDias } from '@/lib/fechas';

export interface DatosGranja {
  madres: Madre[];
  ciclos: Ciclo[];
  alertas: Alerta[];
}

// Todas las fechas son relativas a `hoy`. Con el mismo `hoy` el resultado es idéntico,
// lo que permite saber si alguien ya modificó la demo.
export function crearDatosDemo(hoy: string): DatosGranja {
  const hace = (dias: number) => sumarDias(hoy, -dias);
  const instante = `${hoy}T12:00:00.000Z`;

  const madre = (arete: string, estado: Madre['estado'], diasRegistro: number, diasNacimiento: number, extra: Partial<Madre> = {}): Madre => ({
    id: `demo-${arete}`,
    arete,
    estado,
    fechaNacimiento: hace(diasNacimiento),
    fechaRegistro: hace(diasRegistro),
    ...extra,
  });

  const ciclo = (
    arete: string,
    numeroCiclo: number,
    diasCruce: number,
    estadoCiclo: Ciclo['estadoCiclo'],
    verraco: string,
    tipoCruce: TipoCruce,
    extra: Partial<Ciclo> = {},
  ): Ciclo => ({
    id: `demo-${arete}-c${numeroCiclo}`,
    madreId: `demo-${arete}`,
    numeroCiclo,
    fechaCruce: hace(diasCruce),
    tipoCruce,
    numeroVerraco: verraco,
    intento: 1,
    ...calcularFechasCiclo(hace(diasCruce)),
    estadoCiclo,
    fechaCreacion: instante,
    fechaActualizacion: instante,
    ...extra,
  });

  const parto = (diasParto: number, vivos: number, muertos: number, momias: number, observacionesParto?: string): Partial<Ciclo> => ({
    fechaPartoReal: hace(diasParto),
    nacidosTotales: vivos + muertos + momias,
    nacidosVivos: vivos,
    nacidosMuertos: muertos,
    momias,
    observacionesParto,
  });

  const destete = (diasDestete: number, destetados: number, muertesLactancia: number, pesoNacimiento: number, pesoDestete: number, observacionesDestete?: string): Partial<Ciclo> => ({
    fechaDestete: hace(diasDestete),
    destetados,
    muertesLactancia,
    pesoPromedioNacimiento: pesoNacimiento,
    pesoPromedioDestete: pesoDestete,
    observacionesDestete,
  });

  return {
    madres: [
      // En gestación
      madre('162', 'gestacion', 420, 980, { areteMadre: '25(6-3)', aretePadre: 'Canelo', observaciones: 'Buena madre, tranquila al parir.' }),
      madre('32', 'gestacion', 400, 900, { aretePadre: 'Duroc grande' }),
      madre('25(6-3)', 'gestacion', 760, 1400, { observaciones: 'Abuela: lleva numeración antigua.' }),
      madre('88', 'gestacion', 380, 820),
      madre('9', 'gestacion', 500, 1050, { aretePadre: 'Canelo' }),
      madre('M-07', 'gestacion', 240, 560),
      madre('55', 'gestacion', 210, 520, { areteMadre: '7' }),
      madre('48', 'gestacion', 300, 640, { areteMadre: '162' }),
      madre('61', 'gestacion', 180, 470),
      madre('104', 'gestacion', 120, 390, { areteMadre: '9', observaciones: 'Primer cruce.' }),
      madre('B-12', 'gestacion', 95, 360),
      // En lactancia
      madre('14', 'lactancia', 350, 780),
      madre('A12', 'lactancia', 330, 740, { aretePadre: 'Duroc grande' }),
      madre('A1', 'lactancia', 390, 850),
      madre('77', 'lactancia', 350, 760, { aretePadre: 'Canelo' }),
      madre('120', 'lactancia', 310, 700),
      // Vacías y sin cruzar
      madre('7', 'vacia', 520, 1100),
      madre('19', 'vacia', 450, 930),
      madre('33', 'vacia', 440, 910, { observaciones: 'Revisar aplomos antes del próximo cruce.' }),
      madre('M-21', 'vacia', 20, 250),
      madre('103', 'activa', 12, 230, { areteMadre: '32', observaciones: 'Primeriza, aún sin cruce.' }),
      // Descartadas
      madre('D9', 'descartada', 800, 1600, { fechaDescarte: hace(45), motivoDescarte: 'Edad avanzada y camadas pequeñas' }),
      madre('D3', 'descartada', 260, 700, { fechaDescarte: hace(2), motivoDescarte: 'Repitió celo dos veces' }),
    ],
    ciclos: [
      // Eventos de hoy y próximos días
      ciclo('162', 1, 290, 'finalizado', 'Canelo', 'monta_natural', { ...parto(175, 11, 1, 0), ...destete(147, 10, 1, 1.42, 7.1) }),
      ciclo('162', 2, 110, 'gestacion', '33-47', 'inseminacion', { observacionesCruce: 'Celo firme, se repitió a las 12 horas.' }), // enjaule hoy
      ciclo('32', 1, 300, 'finalizado', 'Duroc grande', 'monta_natural', { ...parto(185, 9, 0, 1), ...destete(157, 9, 0, 1.38, 6.8) }),
      ciclo('32', 2, 118, 'gestacion', 'Duroc grande', 'monta_natural', { observacionesCruce: 'Parto atrasado: vigilar.' }),
      ciclo('25(6-3)', 1, 270, 'finalizado', 'Canelo', 'monta_natural', { ...parto(155, 10, 1, 1), ...destete(127, 9, 1, 1.31, 6.5) }),
      ciclo('25(6-3)', 2, 100, 'gestacion', '33-47', 'inseminacion'), // vacuna hoy
      ciclo('88', 1, 115, 'gestacion', 'Canelo', 'monta_natural'), // parto previsto hoy
      ciclo('9', 1, 280, 'finalizado', 'Canelo', 'monta_natural', { ...parto(165, 12, 0, 0), ...destete(137, 11, 1, 1.44, 7.4) }),
      ciclo('9', 2, 112, 'gestacion', 'Duroc grande', 'monta_natural'),
      // Gestaciones recientes, con partos futuros
      ciclo('M-07', 1, 60, 'gestacion', '33-47', 'inseminacion'),
      ciclo('55', 1, 30, 'gestacion', 'Canelo', 'monta_natural'),
      ciclo('48', 1, 40, 'fallido', 'Canelo', 'monta_natural', { observacionesCruce: 'Repitió celo a los 21 días.' }),
      ciclo('48', 2, 14, 'gestacion', 'Canelo', 'monta_natural', { intento: 2 }),
      ciclo('61', 1, 7, 'gestacion', '33-47', 'inseminacion'),
      ciclo('104', 1, 3, 'gestacion', 'Duroc grande', 'monta_natural', { observacionesCruce: 'Monta tranquila.' }),
      ciclo('B-12', 1, 2, 'gestacion', '33-47', 'inseminacion'),
      // Lactancia
      ciclo('14', 1, 117, 'lactancia', 'Canelo', 'monta_natural', parto(2, 11, 0, 0, 'Parió en la madrugada.')),
      ciclo('A12', 1, 122, 'lactancia', 'Duroc grande', 'monta_natural', parto(7, 9, 1, 0)),
      ciclo('A1', 1, 130, 'lactancia', '33-47', 'inseminacion', parto(15, 12, 1, 0, 'Parto de noche, sin ayuda.')),
      ciclo('77', 1, 140, 'lactancia', 'Canelo', 'monta_natural', parto(25, 10, 0, 1)),
      ciclo('120', 1, 145, 'lactancia', '33-47', 'inseminacion', parto(30, 13, 1, 0)), // destete previsto hoy
      // Vacías con historial
      ciclo('7', 1, 310, 'finalizado', 'Canelo', 'monta_natural', { ...parto(195, 13, 1, 0), ...destete(167, 12, 1, 1.35, 6.9) }),
      ciclo('7', 2, 155, 'finalizado', '33-47', 'inseminacion', { ...parto(40, 11, 0, 0), ...destete(10, 11, 0, 1.4, 7.3, 'Lechones parejos.') }),
      ciclo('19', 1, 148, 'finalizado', 'Duroc grande', 'monta_natural', { ...parto(33, 8, 2, 0), ...destete(3, 7, 1, 1.29, 6.2) }), // siguiente monta en 2 días
      ciclo('33', 1, 150, 'finalizado', 'Canelo', 'monta_natural', { ...parto(35, 10, 0, 0), ...destete(5, 10, 0, 1.37, 7.0) }), // siguiente monta hoy
      // Descartadas
      ciclo('D9', 1, 330, 'finalizado', 'Canelo', 'monta_natural', { ...parto(215, 6, 2, 1), ...destete(187, 5, 1, 1.2, 5.8) }),
      ciclo('D3', 1, 65, 'fallido', 'Canelo', 'monta_natural', { observacionesCruce: 'No quedó preñada.' }),
      ciclo('D3', 2, 30, 'fallido', 'Canelo', 'monta_natural', { intento: 2, observacionesCruce: 'Volvió a repetir celo.' }),
    ],
    alertas: [],
  };
}
