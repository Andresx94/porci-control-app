import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Madre, Ciclo, Alerta, EstadisticasDashboard, EstadoMadre, DatosCruce, DatosParto, DatosDestete } from '@/types';

interface GranjaContextType {
  // Datos
  madres: Madre[];
  ciclos: Ciclo[];
  alertas: Alerta[];
  estadisticas: EstadisticasDashboard;
  
  // Acciones Madres
  agregarMadre: (madre: Omit<Madre, 'id' | 'fechaRegistro'>) => Madre;
  actualizarMadre: (id: string, datos: Partial<Madre>) => void;
  descartarMadre: (id: string, motivo: string) => void;
  obtenerMadre: (id: string) => Madre | undefined;
  
  // Acciones Ciclos
  iniciarCiclo: (madreId: string, datosCruce: DatosCruce) => Ciclo;
  registrarParto: (cicloId: string, datosParto: DatosParto) => void;
  registrarDestete: (cicloId: string, datosDestete: DatosDestete) => void;
  obtenerCiclosMadre: (madreId: string) => Ciclo[];
  obtenerCicloActual: (madreId: string) => Ciclo | undefined;
  
  // Acciones Alertas
  marcarAlertaLeida: (id: string) => void;
  
  // Loading
  isLoading: boolean;
}

const GranjaContext = createContext<GranjaContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MADRES: 'granja_madres',
  CICLOS: 'granja_ciclos',
  ALERTAS: 'granja_alertas',
};

// Días de gestación en cerdas (aproximado)
const DIAS_GESTACION = 114;
const DIAS_LACTANCIA = 21;

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calcularFechaPartoPrevista(fechaCruce: string): string {
  const fecha = new Date(fechaCruce);
  fecha.setDate(fecha.getDate() + DIAS_GESTACION);
  return fecha.toISOString().split('T')[0];
}

export function GranjaProvider({ children }: { children: React.ReactNode }) {
  const [madres, setMadres] = useState<Madre[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos de localStorage al inicio
  useEffect(() => {
    try {
      const madresGuardadas = localStorage.getItem(STORAGE_KEYS.MADRES);
      const ciclosGuardados = localStorage.getItem(STORAGE_KEYS.CICLOS);
      const alertasGuardadas = localStorage.getItem(STORAGE_KEYS.ALERTAS);

      if (madresGuardadas) setMadres(JSON.parse(madresGuardadas));
      if (ciclosGuardados) setCiclos(JSON.parse(ciclosGuardados));
      if (alertasGuardadas) setAlertas(JSON.parse(alertasGuardadas));
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar cambios en localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.MADRES, JSON.stringify(madres));
    }
  }, [madres, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.CICLOS, JSON.stringify(ciclos));
    }
  }, [ciclos, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.ALERTAS, JSON.stringify(alertas));
    }
  }, [alertas, isLoading]);

  // Generar alertas automáticamente
  useEffect(() => {
    if (isLoading) return;
    
    const nuevasAlertas: Alerta[] = [];
    const hoy = new Date();
    const enUnaSemana = new Date();
    enUnaSemana.setDate(hoy.getDate() + 7);

    ciclos.forEach(ciclo => {
      if (ciclo.estadoCiclo === 'gestacion' && ciclo.fechaPartoPrevista) {
        const fechaParto = new Date(ciclo.fechaPartoPrevista);
        if (fechaParto <= enUnaSemana && fechaParto >= hoy) {
          const madre = madres.find(m => m.id === ciclo.madreId);
          if (madre) {
            const existe = alertas.some(a => a.tipo === 'parto_proximo' && a.madreId === ciclo.madreId);
            if (!existe) {
              nuevasAlertas.push({
                id: generarId(),
                tipo: 'parto_proximo',
                madreId: ciclo.madreId,
                mensaje: `${madre.arete} próxima a parir`,
                fechaAlerta: ciclo.fechaPartoPrevista,
                prioridad: 'alta',
                leida: false,
              });
            }
          }
        }
      }

      if (ciclo.estadoCiclo === 'lactancia' && ciclo.fechaPartoReal) {
        const fechaDestetePrevista = new Date(ciclo.fechaPartoReal);
        fechaDestetePrevista.setDate(fechaDestetePrevista.getDate() + DIAS_LACTANCIA);
        if (fechaDestetePrevista <= enUnaSemana && fechaDestetePrevista >= hoy) {
          const madre = madres.find(m => m.id === ciclo.madreId);
          if (madre) {
            const existe = alertas.some(a => a.tipo === 'destete_pendiente' && a.madreId === ciclo.madreId);
            if (!existe) {
              nuevasAlertas.push({
                id: generarId(),
                tipo: 'destete_pendiente',
                madreId: ciclo.madreId,
                mensaje: `${madre.arete} lista para destete`,
                fechaAlerta: fechaDestetePrevista.toISOString().split('T')[0],
                prioridad: 'media',
                leida: false,
              });
            }
          }
        }
      }
    });

    // Madres vacías listas para cruce (más de 7 días desde destete)
    madres.forEach(madre => {
      if (madre.estado === 'vacia') {
        const ultimoCiclo = ciclos
          .filter(c => c.madreId === madre.id && c.estadoCiclo === 'finalizado')
          .sort((a, b) => new Date(b.fechaDestete || 0).getTime() - new Date(a.fechaDestete || 0).getTime())[0];
        
        if (ultimoCiclo?.fechaDestete) {
          const diasDesdeDestete = Math.floor((hoy.getTime() - new Date(ultimoCiclo.fechaDestete).getTime()) / (1000 * 60 * 60 * 24));
          if (diasDesdeDestete >= 7) {
            const existe = alertas.some(a => a.tipo === 'lista_cruce' && a.madreId === madre.id);
            if (!existe) {
              nuevasAlertas.push({
                id: generarId(),
                tipo: 'lista_cruce',
                madreId: madre.id,
                mensaje: `${madre.arete} lista para nuevo cruce`,
                fechaAlerta: hoy.toISOString().split('T')[0],
                prioridad: 'baja',
                leida: false,
              });
            }
          }
        }
      }
    });

    if (nuevasAlertas.length > 0) {
      setAlertas(prev => [...prev, ...nuevasAlertas]);
    }
  }, [madres, ciclos, isLoading]);

  // Calcular estadísticas
  const estadisticas: EstadisticasDashboard = React.useMemo(() => {
    const activas = madres.filter(m => m.estado !== 'descartada');
    const enGestacion = activas.filter(m => m.estado === 'gestacion').length;
    const enLactancia = activas.filter(m => m.estado === 'lactancia').length;
    
    const hoy = new Date();
    const enUnaSemana = new Date();
    enUnaSemana.setDate(hoy.getDate() + 7);
    
    const proximasParir = ciclos.filter(c => {
      if (c.estadoCiclo !== 'gestacion' || !c.fechaPartoPrevista) return false;
      const fechaParto = new Date(c.fechaPartoPrevista);
      return fechaParto >= hoy && fechaParto <= enUnaSemana;
    }).length;

    const listasParaCruce = activas.filter(m => m.estado === 'vacia').length;

    return {
      totalMadresActivas: activas.length,
      enGestacion,
      proximasParir,
      listasParaCruce,
      enLactancia,
    };
  }, [madres, ciclos]);

  // Acciones Madres
  const agregarMadre = useCallback((datos: Omit<Madre, 'id' | 'fechaRegistro'>): Madre => {
    const nuevaMadre: Madre = {
      ...datos,
      id: generarId(),
      fechaRegistro: new Date().toISOString(),
    };
    setMadres(prev => [...prev, nuevaMadre]);
    return nuevaMadre;
  }, []);

  const actualizarMadre = useCallback((id: string, datos: Partial<Madre>) => {
    setMadres(prev => prev.map(m => m.id === id ? { ...m, ...datos } : m));
  }, []);

  const descartarMadre = useCallback((id: string, motivo: string) => {
    setMadres(prev => prev.map(m => m.id === id ? {
      ...m,
      estado: 'descartada' as EstadoMadre,
      fechaDescarte: new Date().toISOString(),
      motivoDescarte: motivo,
    } : m));
  }, []);

  const obtenerMadre = useCallback((id: string) => {
    return madres.find(m => m.id === id);
  }, [madres]);

  // Acciones Ciclos
  const iniciarCiclo = useCallback((madreId: string, datosCruce: DatosCruce): Ciclo => {
    const ciclosMadre = ciclos.filter(c => c.madreId === madreId);
    const numeroCiclo = ciclosMadre.length + 1;
    
    const nuevoCiclo: Ciclo = {
      id: generarId(),
      madreId,
      numeroCiclo,
      fechaCruce: datosCruce.fechaCruce,
      tipoCruce: datosCruce.tipoCruce,
      intento: datosCruce.intento,
      observacionesCruce: datosCruce.observaciones,
      fechaPartoPrevista: calcularFechaPartoPrevista(datosCruce.fechaCruce),
      estadoCiclo: 'gestacion',
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };
    
    setCiclos(prev => [...prev, nuevoCiclo]);
    actualizarMadre(madreId, { estado: 'gestacion' });
    
    return nuevoCiclo;
  }, [ciclos, actualizarMadre]);

  const registrarParto = useCallback((cicloId: string, datosParto: DatosParto) => {
    setCiclos(prev => prev.map(c => {
      if (c.id !== cicloId) return c;
      return {
        ...c,
        fechaPartoReal: datosParto.fechaPartoReal,
        nacidosTotales: datosParto.nacidosTotales,
        nacidosVivos: datosParto.nacidosVivos,
        nacidosMuertos: datosParto.nacidosMuertos,
        observacionesParto: datosParto.observaciones,
        estadoCiclo: 'lactancia',
        fechaActualizacion: new Date().toISOString(),
      };
    }));

    const ciclo = ciclos.find(c => c.id === cicloId);
    if (ciclo) {
      actualizarMadre(ciclo.madreId, { estado: 'lactancia' });
    }
  }, [ciclos, actualizarMadre]);

  const registrarDestete = useCallback((cicloId: string, datosDestete: DatosDestete) => {
    setCiclos(prev => prev.map(c => {
      if (c.id !== cicloId) return c;
      return {
        ...c,
        fechaDestete: datosDestete.fechaDestete,
        destetados: datosDestete.destetados,
        muertesLactancia: datosDestete.muertesLactancia,
        observacionesDestete: datosDestete.observaciones,
        estadoCiclo: 'finalizado',
        fechaActualizacion: new Date().toISOString(),
      };
    }));

    const ciclo = ciclos.find(c => c.id === cicloId);
    if (ciclo) {
      actualizarMadre(ciclo.madreId, { estado: 'vacia' });
    }
  }, [ciclos, actualizarMadre]);

  const obtenerCiclosMadre = useCallback((madreId: string) => {
    return ciclos
      .filter(c => c.madreId === madreId)
      .sort((a, b) => b.numeroCiclo - a.numeroCiclo);
  }, [ciclos]);

  const obtenerCicloActual = useCallback((madreId: string) => {
    return ciclos.find(c => c.madreId === madreId && c.estadoCiclo !== 'finalizado' && c.estadoCiclo !== 'fallido');
  }, [ciclos]);

  // Acciones Alertas
  const marcarAlertaLeida = useCallback((id: string) => {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a));
  }, []);

  return (
    <GranjaContext.Provider value={{
      madres,
      ciclos,
      alertas,
      estadisticas,
      agregarMadre,
      actualizarMadre,
      descartarMadre,
      obtenerMadre,
      iniciarCiclo,
      registrarParto,
      registrarDestete,
      obtenerCiclosMadre,
      obtenerCicloActual,
      marcarAlertaLeida,
      isLoading,
    }}>
      {children}
    </GranjaContext.Provider>
  );
}

export function useGranja() {
  const context = useContext(GranjaContext);
  if (!context) {
    throw new Error('useGranja debe usarse dentro de GranjaProvider');
  }
  return context;
}
