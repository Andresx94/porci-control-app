import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Madre, Ciclo, Alerta, EstadisticasDashboard, EstadoMadre, DatosCruce, DatosParto, DatosDestete, DatosFallo } from '@/types';
import { ordenarCiclos, siguienteCiclo } from '@/lib/ciclos';
import { calcularFechasCiclo, diasEntre, esProximaAParir, hoyISO, sumarDias } from '@/lib/fechas';
import { cargarDatos, CLAVES, contarPendientes, Conflicto, esDemo, guardarLista, leerConflictos } from '@/lib/datos';
import { generarUuid } from '@/lib/utils';
import { hayNube, supabase } from '@/lib/supabase';
import { ErrorRed, sincronizar } from '@/lib/sincronizacion';
import {
  elegirGranjaGuardada,
  granjaElegida,
  granjasDelUsuario,
  GranjaUsuario,
  iniciarSesion,
  cerrarSesion,
  remotoSupabase,
  resolverGranja,
  usuarioActual,
} from '@/lib/remotoSupabase';

export type EstadoNube = 'apagada' | 'sin_sesion' | 'sincronizando' | 'al_dia' | 'sin_conexion' | 'error';

const INTERVALO_SYNC_MS = 60_000;
const ESPERA_SYNC_MS = 3_000;

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
  editarCruce: (cicloId: string, datosCruce: DatosCruce) => void;
  marcarFallido: (cicloId: string, datos: DatosFallo) => void;
  proximoCiclo: (madreId: string) => { numeroCiclo: number; intento: number };
  registrarParto: (cicloId: string, datosParto: DatosParto) => void;
  registrarDestete: (cicloId: string, datosDestete: DatosDestete) => void;
  obtenerCiclosMadre: (madreId: string) => Ciclo[];
  obtenerCicloActual: (madreId: string) => Ciclo | undefined;
  
  // Acciones Alertas
  marcarAlertaLeida: (id: string) => void;
  
  // Loading
  isLoading: boolean;

  // Nube (apagada si no hay configuración o estamos en demo)
  estadoNube: EstadoNube;
  pendientes: number;
  conflictos: Conflicto[];
  sincronizarAhora: () => Promise<void>;
  correoNube: string | null;
  // false mientras se lee la sesion guardada al arrancar (evita el parpadeo del login)
  sesionComprobada: boolean;
  // true cuando la lista de granjas se leyo bien (puede estar vacia)
  granjasCargadas: boolean;
  granjasNube: GranjaUsuario[];
  granjaNubeId: string | null;
  elegirGranjaNube: (id: string) => void;
  entrarNube: (email: string, password: string) => Promise<void>;
  salirNube: () => Promise<void>;
}

const GranjaContext = createContext<GranjaContextType | undefined>(undefined);

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function GranjaProvider({ children }: { children: React.ReactNode }) {
  const [madres, setMadres] = useState<Madre[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos al inicio (reales o de demo, según la URL)
  useEffect(() => {
    try {
      const datos = cargarDatos();
      setMadres(datos.madres);
      setCiclos(datos.ciclos);
      setAlertas(datos.alertas);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar cambios
  useEffect(() => {
    if (!isLoading) guardarLista(CLAVES.MADRES, madres);
  }, [madres, isLoading]);

  useEffect(() => {
    if (!isLoading) guardarLista(CLAVES.CICLOS, ciclos);
  }, [ciclos, isLoading]);

  useEffect(() => {
    if (!isLoading) guardarLista(CLAVES.ALERTAS, alertas);
  }, [alertas, isLoading]);

  // Generar alertas automáticamente
  useEffect(() => {
    if (isLoading) return;
    
    const nuevasAlertas: Alerta[] = [];
    const hoy = hoyISO();
    const enUnaSemana = sumarDias(hoy, 7);

    ciclos.forEach(ciclo => {
      if (ciclo.estadoCiclo === 'gestacion' && ciclo.fechaPartoPrevista) {
        const fechaParto = ciclo.fechaPartoPrevista;
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

      if (ciclo.estadoCiclo === 'lactancia' && ciclo.fechaDestetePrevista) {
        const fechaDestetePrevista = ciclo.fechaDestetePrevista;
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
                fechaAlerta: fechaDestetePrevista,
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
          .sort((a, b) => (b.fechaDestete || '').localeCompare(a.fechaDestete || ''))[0];
        
        if (ultimoCiclo?.fechaDestete) {
          const diasDesdeDestete = diasEntre(ultimoCiclo.fechaDestete, hoy);
          if (diasDesdeDestete >= 7) {
            const existe = alertas.some(a => a.tipo === 'lista_cruce' && a.madreId === madre.id);
            if (!existe) {
              nuevasAlertas.push({
                id: generarId(),
                tipo: 'lista_cruce',
                madreId: madre.id,
                mensaje: `${madre.arete} lista para nuevo cruce`,
                fechaAlerta: hoy,
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

  // ---------------------------------------------------------------- nube
  const nubeActiva = !esDemo() && hayNube();
  const [estadoNube, setEstadoNube] = useState<EstadoNube>(nubeActiva ? 'sin_sesion' : 'apagada');
  const [pendientes, setPendientes] = useState(0);
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [correoNube, setCorreoNube] = useState<string | null>(null);
  const [sesionComprobada, setSesionComprobada] = useState(!nubeActiva);
  const [granjasCargadas, setGranjasCargadas] = useState(false);
  const [granjasNube, setGranjasNube] = useState<GranjaUsuario[]>([]);
  const [granjaNubeId, setGranjaNubeId] = useState<string | null>(() => (nubeActiva ? granjaElegida() : null));
  const granjaRef = useRef<string | null>(null);
  const sesionRef = useRef(false);
  const corriendo = useRef(false);

  const refrescarCola = useCallback(() => {
    if (!nubeActiva) return;
    setPendientes(contarPendientes());
    setConflictos(leerConflictos());
  }, [nubeActiva]);

  const sincronizarAhora = useCallback(async () => {
    const granja = granjaRef.current;
    if (!nubeActiva || !sesionRef.current || !granja || corriendo.current) return;
    corriendo.current = true;
    setEstadoNube('sincronizando');
    try {
      const r = await sincronizar(remotoSupabase, granja);
      if (r.cambiosLocales) {
        // Lo bajado ya está en localStorage; recargar no re-encola porque no hay diferencia.
        const datos = cargarDatos();
        setMadres(datos.madres);
        setCiclos(datos.ciclos);
      }
      setEstadoNube('al_dia');
    } catch (error) {
      console.error('Error sincronizando:', error);
      setEstadoNube(error instanceof ErrorRed || !navigator.onLine ? 'sin_conexion' : 'error');
    } finally {
      corriendo.current = false;
      refrescarCola();
    }
  }, [nubeActiva, refrescarCola]);

  // Sesión guardada en el dispositivo y cambios de sesión
  useEffect(() => {
    if (!nubeActiva || !supabase) return;
    let vivo = true;
    usuarioActual()
      .then(u => vivo && setCorreoNube(u ? u.email : null))
      .catch(() => {})
      .finally(() => vivo && setSesionComprobada(true));
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setCorreoNube(sesion?.user?.email ?? null);
      setSesionComprobada(true);
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [nubeActiva]);

  // Granjas del usuario (si no hay red se conserva la granja elegida antes)
  useEffect(() => {
    sesionRef.current = correoNube !== null;
    if (!nubeActiva) return;
    if (correoNube === null) {
      setGranjasNube([]);
      setGranjasCargadas(false);
      setEstadoNube('sin_sesion');
      return;
    }
    let vivo = true;
    granjasDelUsuario()
      .then(lista => {
        if (!vivo) return;
        setGranjasNube(lista);
        setGranjasCargadas(true);
        const id = resolverGranja(lista, granjaElegida());
        if (id) {
          elegirGranjaGuardada(id);
          setGranjaNubeId(id);
        }
      })
      .catch(error => console.error('Error leyendo granjas:', error));
    return () => {
      vivo = false;
    };
  }, [nubeActiva, correoNube]);

  useEffect(() => {
    granjaRef.current = granjaNubeId;
  }, [granjaNubeId]);

  // Al cargar, al volver la señal y cada minuto
  useEffect(() => {
    if (!nubeActiva || isLoading || !correoNube || !granjaNubeId) return;
    granjaRef.current = granjaNubeId;
    sesionRef.current = true;
    sincronizarAhora();
    const alVolver = () => {
      sincronizarAhora();
    };
    window.addEventListener('online', alVolver);
    const timer = window.setInterval(alVolver, INTERVALO_SYNC_MS);
    return () => {
      window.removeEventListener('online', alVolver);
      window.clearInterval(timer);
    };
  }, [nubeActiva, isLoading, correoNube, granjaNubeId, sincronizarAhora]);

  // 3 s después de cualquier cambio local
  useEffect(() => {
    if (!nubeActiva || isLoading) return;
    refrescarCola();
    if (!correoNube || !granjaNubeId) return;
    const timer = window.setTimeout(() => {
      if (contarPendientes() > 0) sincronizarAhora();
    }, ESPERA_SYNC_MS);
    return () => window.clearTimeout(timer);
  }, [madres, ciclos, nubeActiva, isLoading, correoNube, granjaNubeId, sincronizarAhora, refrescarCola]);

  const elegirGranjaNube = useCallback((id: string) => {
    elegirGranjaGuardada(id);
    setGranjaNubeId(id);
  }, []);

  const entrarNube = useCallback(async (email: string, password: string) => {
    await iniciarSesion(email, password);
  }, []);

  const salirNube = useCallback(async () => {
    await cerrarSesion();
    setCorreoNube(null);
    // Vuelve a la URL base sin parametros: login (modo real con nube)
    window.location.replace(import.meta.env.BASE_URL);
  }, []);

  // Calcular estadísticas
  const estadisticas: EstadisticasDashboard = React.useMemo(() => {
    const activas = madres.filter(m => m.estado !== 'descartada');
    const enGestacion = activas.filter(m => m.estado === 'gestacion').length;
    const enLactancia = activas.filter(m => m.estado === 'lactancia').length;
    
    const proximasParir = ciclos.filter(c =>
      esProximaAParir(c) && activas.some(m => m.id === c.madreId)
    ).length;

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
      id: generarUuid(),
      fechaRegistro: hoyISO(),
      registradoEn: new Date().toISOString(),
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
      fechaDescarte: hoyISO(),
      descartadoEn: new Date().toISOString(),
      motivoDescarte: motivo,
    } : m));
  }, []);

  const obtenerMadre = useCallback((id: string) => {
    return madres.find(m => m.id === id);
  }, [madres]);

  // Acciones Ciclos
  const iniciarCiclo = useCallback((madreId: string, datosCruce: DatosCruce): Ciclo => {
    const { numeroCiclo } = siguienteCiclo(ciclos.filter(c => c.madreId === madreId));

    const fechas = calcularFechasCiclo(datosCruce.fechaCruce);
    const nuevoCiclo: Ciclo = {
      id: generarUuid(),
      madreId,
      numeroCiclo,
      fechaCruce: datosCruce.fechaCruce,
      tipoCruce: datosCruce.tipoCruce,
      numeroVerraco: datosCruce.numeroVerraco,
      intento: datosCruce.intento,
      observacionesCruce: datosCruce.observaciones,
      ...fechas,
      estadoCiclo: 'gestacion',
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };
    
    setCiclos(prev => [...prev, nuevoCiclo]);
    actualizarMadre(madreId, { estado: 'gestacion' });
    
    return nuevoCiclo;
  }, [ciclos, actualizarMadre]);

  const editarCruce = useCallback((cicloId: string, datosCruce: DatosCruce) => {
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo) return;

    setCiclos(prev => prev.map(c => c.id !== cicloId ? c : {
      ...c,
      fechaCruce: datosCruce.fechaCruce,
      tipoCruce: datosCruce.tipoCruce,
      numeroVerraco: datosCruce.numeroVerraco,
      intento: datosCruce.intento,
      observacionesCruce: datosCruce.observaciones,
      ...calcularFechasCiclo(datosCruce.fechaCruce),
      fechaActualizacion: new Date().toISOString(),
    }));

    // Las alertas de fechas anteriores ya no valen; se regeneran con las nuevas.
    if (ciclo.fechaCruce !== datosCruce.fechaCruce) {
      setAlertas(prev => prev.filter(a =>
        a.madreId !== ciclo.madreId || (a.tipo !== 'parto_proximo' && a.tipo !== 'destete_pendiente')
      ));
    }
  }, [ciclos]);

  const marcarFallido = useCallback((cicloId: string, datos: DatosFallo) => {
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo) return;

    setCiclos(prev => prev.map(c => c.id !== cicloId ? c : {
      ...c,
      fechaFallo: datos.fechaFallo,
      motivoFallo: datos.motivoFallo,
      observacionesFallo: datos.observaciones,
      estadoCiclo: 'fallido',
      fechaActualizacion: new Date().toISOString(),
    }));
    setAlertas(prev => prev.filter(a => a.madreId !== ciclo.madreId || a.tipo !== 'parto_proximo'));
    actualizarMadre(ciclo.madreId, { estado: 'vacia' });
  }, [ciclos, actualizarMadre]);

  const proximoCiclo = useCallback((madreId: string) => {
    return siguienteCiclo(ciclos.filter(c => c.madreId === madreId));
  }, [ciclos]);

  const registrarParto = useCallback((cicloId: string, datosParto: DatosParto) => {
    setCiclos(prev => prev.map(c => {
      if (c.id !== cicloId) return c;
      return {
        ...c,
        fechaPartoReal: datosParto.fechaPartoReal,
        nacidosTotales: datosParto.nacidosTotales,
        nacidosVivos: datosParto.nacidosVivos,
        nacidosMuertos: datosParto.nacidosMuertos,
        momias: datosParto.momias,
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
        pesoPromedioNacimiento: datosDestete.pesoPromedioNacimiento,
        pesoPromedioDestete: datosDestete.pesoPromedioDestete,
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
    return ordenarCiclos(ciclos.filter(c => c.madreId === madreId));
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
      editarCruce,
      marcarFallido,
      proximoCiclo,
      registrarParto,
      registrarDestete,
      obtenerCiclosMadre,
      obtenerCicloActual,
      marcarAlertaLeida,
      isLoading,
      estadoNube,
      pendientes,
      conflictos,
      sincronizarAhora,
      correoNube,
      sesionComprobada,
      granjasCargadas,
      granjasNube,
      granjaNubeId,
      elegirGranjaNube,
      entrarNube,
      salirNube,
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
