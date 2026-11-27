import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Madre, Ciclo, Alerta, EstadisticasDashboard, EstadoMadre, DatosCruce, DatosParto, DatosDestete, DatosFallo } from '@/types';
import { ordenarCiclos, siguienteCiclo } from '@/lib/ciclos';
import { calcularFechasCiclo, esProximaAParir, hoyISO } from '@/lib/fechas';
import { alertasIguales, calcularAlertas } from '@/lib/alertas';
import { cargarDatos, CLAVES, contarPendientes, Conflicto, esDemo, guardarLista, guardarPreferencia, leerConflictos, leerPreferencia } from '@/lib/datos';
import { toast } from 'sonner';
import { Accion, cicloVacioPara, puede, RolNube } from '@/lib/permisos';
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
  UsuarioNube,
} from '@/lib/remotoSupabase';

export type EstadoNube = 'apagada' | 'sin_sesion' | 'sincronizando' | 'al_dia' | 'sin_conexion' | 'error';

const PREF_ROL = 'rol_nube';

interface RolGuardado {
  granja: string;
  rol: string;
  venceEn: string | null;
}

function leerRolGuardado(): RolGuardado | null {
  try {
    const v = JSON.parse(leerPreferencia(PREF_ROL) || 'null');
    return v && typeof v.granja === 'string' && typeof v.rol === 'string' ? v : null;
  } catch {
    return null;
  }
}

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
  // Sesion de nube activa (el trabajador entra sin correo, con sesion anonima)
  haySesion: boolean;
  sesionAnonima: boolean;
  // Rol en la granja actual: null en demo, sin nube o sin dato (todo permitido en la interfaz)
  rolNube: RolNube;
  // Fin del acceso del trabajador en la granja actual (null = no vence)
  venceNube: string | null;
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

  // Alertas: se recalculan desde madres y ciclos (solo locales, no marcan cambios)
  const diaAlertas = useRef('');
  useEffect(() => {
    if (isLoading) return;
    const recalcular = () => {
      const hoy = hoyISO();
      diaAlertas.current = hoy;
      setAlertas(prev => {
        const nuevas = calcularAlertas(madres, ciclos, prev, hoy);
        return alertasIguales(prev, nuevas) ? prev : nuevas;
      });
    };
    recalcular();
    // Al volver a la pestaña, recalcular solo si cambió el día.
    const alVolver = () => {
      if (document.visibilityState === 'visible' && hoyISO() !== diaAlertas.current) recalcular();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [madres, ciclos, isLoading]);

  // ---------------------------------------------------------------- nube
  const nubeActiva = !esDemo() && hayNube();
  const [estadoNube, setEstadoNube] = useState<EstadoNube>(nubeActiva ? 'sin_sesion' : 'apagada');
  const [pendientes, setPendientes] = useState(0);
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [sesionNube, setSesionNube] = useState<UsuarioNube | null>(null);
  const haySesion = sesionNube !== null;
  const correoNube = sesionNube?.email || null;
  const [sesionComprobada, setSesionComprobada] = useState(!nubeActiva);
  const [granjasCargadas, setGranjasCargadas] = useState(false);
  const [granjasNube, setGranjasNube] = useState<GranjaUsuario[]>([]);
  const [granjaNubeId, setGranjaNubeId] = useState<string | null>(() => (nubeActiva ? granjaElegida() : null));
  // Rol y fin de acceso recordados en el dispositivo, para saberlos también sin señal.
  const [rolGuardado, setRolGuardado] = useState<RolGuardado | null>(() => (nubeActiva ? leerRolGuardado() : null));
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
      .then(u => vivo && setSesionNube(u))
      .catch(() => {})
      .finally(() => vivo && setSesionComprobada(true));
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const u = sesion?.user;
      // Misma sesión (p. ej. refresco de token): conservar el objeto evita recargas.
      setSesionNube(prev =>
        !u ? null : prev && prev.id === u.id ? prev : { id: u.id, email: u.email ?? '', anonimo: !!u.is_anonymous }
      );
      setSesionComprobada(true);
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [nubeActiva]);

  // Granjas del usuario (si no hay red se conserva la granja elegida antes)
  useEffect(() => {
    sesionRef.current = haySesion;
    if (!nubeActiva) return;
    if (!haySesion) {
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
          const g = lista.find(x => x.id === id);
          if (g) {
            guardarPreferencia(PREF_ROL, JSON.stringify({ granja: id, rol: g.rol, venceEn: g.venceEn }));
            setRolGuardado({ granja: id, rol: g.rol, venceEn: g.venceEn });
          }
        }
      })
      .catch(error => console.error('Error leyendo granjas:', error));
    return () => {
      vivo = false;
    };
  }, [nubeActiva, haySesion, sesionNube?.id]);

  useEffect(() => {
    granjaRef.current = granjaNubeId;
  }, [granjaNubeId]);

  // Al cargar, al volver la señal y cada minuto
  useEffect(() => {
    if (!nubeActiva || isLoading || !haySesion || !granjaNubeId) return;
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
  }, [nubeActiva, isLoading, haySesion, granjaNubeId, sincronizarAhora]);

  // 3 s después de cualquier cambio local
  useEffect(() => {
    if (!nubeActiva || isLoading) return;
    refrescarCola();
    if (!haySesion || !granjaNubeId) return;
    const timer = window.setTimeout(() => {
      if (contarPendientes() > 0) sincronizarAhora();
    }, ESPERA_SYNC_MS);
    return () => window.clearTimeout(timer);
  }, [madres, ciclos, nubeActiva, isLoading, haySesion, granjaNubeId, sincronizarAhora, refrescarCola]);

  const elegirGranjaNube = useCallback((id: string) => {
    elegirGranjaGuardada(id);
    setGranjaNubeId(id);
  }, []);

  const entrarNube = useCallback(async (email: string, password: string) => {
    await iniciarSesion(email, password);
  }, []);

  const salirNube = useCallback(async () => {
    await cerrarSesion();
    setSesionNube(null);
    guardarPreferencia(PREF_ROL, '');
    // Vuelve a la URL base sin parametros: login (modo real con nube)
    window.location.replace(import.meta.env.BASE_URL);
  }, []);

  // Rol en la granja actual (sin dato y con sesión anónima: trabajador, por seguridad)
  const granjaActual = granjasNube.find(g => g.id === granjaNubeId);
  const infoRol = granjaActual ?? (rolGuardado && rolGuardado.granja === granjaNubeId ? rolGuardado : null);
  const rolNube: RolNube = !nubeActiva
    ? null
    : infoRol
      ? infoRol.rol === 'operario' ? 'operario' : 'dueno'
      : sesionNube?.anonimo ? 'operario' : null;
  const venceNube = infoRol?.venceEn ?? null;

  // Guarda de acciones: el trabajador no puede ejecutar lo prohibido aunque alguien lo llame.
  const rolRef = useRef<RolNube>(null);
  rolRef.current = rolNube;
  const denegar = useCallback((accion: Accion): boolean => {
    if (puede(rolRef.current, accion)) return false;
    toast.error('Tu acceso de trabajador no permite esta acción');
    return true;
  }, []);
  // El trabajador solo registra parto, destete o fallo cuando esos datos están vacíos.
  const denegarCiclo = useCallback((accion: 'registrarParto' | 'registrarDestete' | 'registrarFallo', ciclo: Ciclo | undefined): boolean => {
    if (denegar(accion)) return true;
    if (rolRef.current === 'operario' && ciclo && !cicloVacioPara(accion, ciclo)) {
      toast.error('Ese dato ya está registrado y el trabajador no puede cambiarlo');
      return true;
    }
    return false;
  }, [denegar]);

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
    if (denegar('crearMadre')) return { ...datos, id: '', fechaRegistro: hoyISO() };
    const nuevaMadre: Madre = {
      ...datos,
      id: generarUuid(),
      fechaRegistro: hoyISO(),
      registradoEn: new Date().toISOString(),
    };
    setMadres(prev => [...prev, nuevaMadre]);
    return nuevaMadre;
  }, [denegar]);

  // Interno: cambia solo el estado de la madre al crear cruce o registrar parto, destete o fallo
  // (es lo único que el trabajador puede cambiar de una madre).
  const cambiarEstadoMadre = useCallback((id: string, estado: EstadoMadre) => {
    setMadres(prev => prev.map(m => m.id === id ? { ...m, estado } : m));
  }, []);

  const actualizarMadre = useCallback((id: string, datos: Partial<Madre>) => {
    if (denegar('editarMadre')) return;
    setMadres(prev => prev.map(m => m.id === id ? { ...m, ...datos } : m));
  }, [denegar]);

  const descartarMadre = useCallback((id: string, motivo: string) => {
    if (denegar('descartarMadre')) return;
    setMadres(prev => prev.map(m => m.id === id ? {
      ...m,
      estado: 'descartada' as EstadoMadre,
      fechaDescarte: hoyISO(),
      descartadoEn: new Date().toISOString(),
      motivoDescarte: motivo,
    } : m));
  }, [denegar]);

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
    cambiarEstadoMadre(madreId, 'gestacion');
    
    return nuevoCiclo;
  }, [ciclos, cambiarEstadoMadre]);

  const editarCruce = useCallback((cicloId: string, datosCruce: DatosCruce) => {
    if (denegar('editarCruce')) return;
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
  }, [ciclos, denegar]);

  const marcarFallido = useCallback((cicloId: string, datos: DatosFallo) => {
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo || denegarCiclo('registrarFallo', ciclo)) return;

    setCiclos(prev => prev.map(c => c.id !== cicloId ? c : {
      ...c,
      fechaFallo: datos.fechaFallo,
      motivoFallo: datos.motivoFallo,
      observacionesFallo: datos.observaciones,
      estadoCiclo: 'fallido',
      fechaActualizacion: new Date().toISOString(),
    }));
    cambiarEstadoMadre(ciclo.madreId, 'vacia');
  }, [ciclos, cambiarEstadoMadre, denegarCiclo]);

  const proximoCiclo = useCallback((madreId: string) => {
    return siguienteCiclo(ciclos.filter(c => c.madreId === madreId));
  }, [ciclos]);

  const registrarParto = useCallback((cicloId: string, datosParto: DatosParto) => {
    if (denegarCiclo('registrarParto', ciclos.find(c => c.id === cicloId))) return;
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
      cambiarEstadoMadre(ciclo.madreId, 'lactancia');
    }
  }, [ciclos, cambiarEstadoMadre, denegarCiclo]);

  const registrarDestete = useCallback((cicloId: string, datosDestete: DatosDestete) => {
    if (denegarCiclo('registrarDestete', ciclos.find(c => c.id === cicloId))) return;
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
      cambiarEstadoMadre(ciclo.madreId, 'vacia');
    }
  }, [ciclos, cambiarEstadoMadre, denegarCiclo]);

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
      haySesion,
      sesionAnonima: sesionNube?.anonimo ?? false,
      rolNube,
      venceNube,
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
