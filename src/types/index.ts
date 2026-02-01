// Tipos para el sistema de control reproductivo porcino

export type EstadoMadre = 'activa' | 'gestacion' | 'lactancia' | 'vacia' | 'descartada';

export type EstadoCiclo = 'cruce' | 'gestacion' | 'parto' | 'lactancia' | 'finalizado' | 'fallido';

export type TipoCruce = 'monta_natural' | 'inseminacion';

export interface Madre {
  id: string;
  arete: string;
  fechaNacimiento?: string;
  estado: EstadoMadre;
  observaciones?: string;
  fechaRegistro: string;
  fechaDescarte?: string;
  motivoDescarte?: string;
}

export interface Ciclo {
  id: string;
  madreId: string;
  numeroCiclo: number;
  // Datos de cruce
  fechaCruce: string;
  tipoCruce: TipoCruce;
  intento: number;
  observacionesCruce?: string;
  // Datos de parto
  fechaPartoPrevista?: string;
  fechaPartoReal?: string;
  nacidosTotales?: number;
  nacidosVivos?: number;
  nacidosMuertos?: number;
  observacionesParto?: string;
  // Datos de lactancia/destete
  fechaDestete?: string;
  destetados?: number;
  muertesLactancia?: number;
  observacionesDestete?: string;
  // Estado
  estadoCiclo: EstadoCiclo;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface Alerta {
  id: string;
  tipo: 'parto_proximo' | 'destete_pendiente' | 'lista_cruce' | 'revision';
  madreId: string;
  mensaje: string;
  fechaAlerta: string;
  prioridad: 'alta' | 'media' | 'baja';
  leida: boolean;
}

// Estadísticas del dashboard
export interface EstadisticasDashboard {
  totalMadresActivas: number;
  enGestacion: number;
  proximasParir: number;
  listasParaCruce: number;
  enLactancia: number;
}

// Datos de formulario para ciclo
export interface DatosCruce {
  fechaCruce: string;
  tipoCruce: TipoCruce;
  intento: number;
  observaciones?: string;
}

export interface DatosParto {
  fechaPartoReal: string;
  nacidosTotales: number;
  nacidosVivos: number;
  nacidosMuertos: number;
  observaciones?: string;
}

export interface DatosDestete {
  fechaDestete: string;
  destetados: number;
  muertesLactancia: number;
  observaciones?: string;
}
