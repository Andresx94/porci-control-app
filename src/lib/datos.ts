import { Alerta, Ciclo, Madre } from '@/types';
import { aFechaPura, diaLocal, hoyISO } from '@/lib/fechas';
import { crearDatosDemo, DatosGranja, VERSION_DEMO } from '@/lib/demo';

export const CLAVES = {
  MADRES: 'granja_madres',
  CICLOS: 'granja_ciclos',
  ALERTAS: 'granja_alertas',
};

const CLAVE_RESPALDO = 'granja_respaldo_antes_fechas';
const CLAVE_PENDIENTES = 'granja_pendientes';
const CLAVE_CONFLICTOS = 'granja_conflictos';
const PREFIJO_CURSOR = 'granja_sync_';
const PREFIJO_DEMO = 'demo_';
const CLAVE_DIA_DEMO = `${PREFIJO_DEMO}dia`;
const CLAVE_VERSION_DEMO = `${PREFIJO_DEMO}version`;

// Nube configurada = variables de Supabase presentes (se lee al llamar, no al importar).
export function nubeConfigurada(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

// ?demo=1 -> demo; ?real=1 -> real; sin parametro -> real si hay nube (abre en el login),
// y demo si no la hay. La demo guarda todo con el prefijo demo_ y nunca lee ni borra
// los datos reales (claves granja_*).
export function esDemo(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') return true;
  if (params.get('real') === '1') return false;
  return !nubeConfigurada();
}

const clave = (nombre: string) => (esDemo() ? `${PREFIJO_DEMO}${nombre}` : nombre);

export function hayDatosReales(): boolean {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVES.MADRES) ?? '[]');
    return Array.isArray(lista) && lista.length > 0;
  } catch {
    return true; // Hay algo guardado aunque no se pueda leer.
  }
}

const CAMPOS_CICLO = [
  'fechaCruce',
  'fechaPartoPrevista',
  'fechaVacunaSuicen',
  'fechaEnjaule',
  'fechaDestetePrevista',
  'fechaSiguienteMonta',
  'fechaPartoReal',
  'fechaDestete',
  'fechaFallo',
] as const;

const normalizar = <T extends object>(obj: T, campos: readonly (keyof T)[]): T => {
  const copia = { ...obj };
  campos.forEach(campo => {
    const pura = aFechaPura(copia[campo]);
    if (pura) (copia[campo] as unknown) = pura;
  });
  return copia;
};

// Pasa una marca de tiempo antigua a su día local y conserva el instante original.
const separarInstante = (madre: Madre, campoDia: 'fechaRegistro' | 'fechaDescarte', campoInstante: 'registradoEn' | 'descartadoEn'): Madre => {
  const valor = madre[campoDia];
  if (!valor || !valor.includes('T')) return madre;
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return madre;
  return { ...madre, [campoDia]: diaLocal(instante), [campoInstante]: madre[campoInstante] ?? valor };
};

export function migrarDatos(datos: DatosGranja): DatosGranja {
  return {
    madres: datos.madres.map(m =>
      separarInstante(separarInstante(normalizar(m, ['fechaNacimiento']), 'fechaRegistro', 'registradoEn'), 'fechaDescarte', 'descartadoEn')
    ),
    ciclos: datos.ciclos.map(c => normalizar(c, CAMPOS_CICLO)),
    alertas: datos.alertas.map(a => normalizar(a, ['fechaAlerta'])),
  };
}

function leerLista<T>(nombre: string): T[] {
  const crudo = localStorage.getItem(nombre);
  if (!crudo) return [];
  try {
    const lista = JSON.parse(crudo);
    if (Array.isArray(lista)) return lista;
  } catch {
    // Se conserva abajo para no perderlo cuando la app guarde de nuevo.
  }
  console.error(`Datos ilegibles en ${nombre}; se conserva una copia en ${nombre}_danado`);
  localStorage.setItem(`${nombre}_danado`, crudo);
  return [];
}

function leerDatos(): DatosGranja {
  return {
    madres: leerLista<Madre>(clave(CLAVES.MADRES)),
    ciclos: leerLista<Ciclo>(clave(CLAVES.CICLOS)),
    alertas: leerLista<Alerta>(clave(CLAVES.ALERTAS)),
  };
}

function escribirDatos(datos: DatosGranja) {
  localStorage.setItem(clave(CLAVES.MADRES), JSON.stringify(datos.madres));
  localStorage.setItem(clave(CLAVES.CICLOS), JSON.stringify(datos.ciclos));
  localStorage.setItem(clave(CLAVES.ALERTAS), JSON.stringify(datos.alertas));
}

function cargarDemo(): DatosGranja {
  const hoy = hoyISO();
  try {
    const dia = localStorage.getItem(CLAVE_DIA_DEMO);
    const guardados = leerDatos();

    // Una demo sin tocar se actualiza al día de hoy; una editada se respeta hasta el reset.
    // Si cambian los datos de ejemplo de la app, la demo se vuelve a generar.
    let regenerar = !dia || localStorage.getItem(CLAVE_VERSION_DEMO) !== VERSION_DEMO;
    if (!regenerar && dia && dia !== hoy) {
      const base = crearDatosDemo(dia);
      regenerar = JSON.stringify([guardados.madres, guardados.ciclos]) === JSON.stringify([base.madres, base.ciclos]);
    }
    if (!regenerar) return guardados;

    const nuevos = crearDatosDemo(hoy);
    escribirDatos(nuevos);
    localStorage.setItem(CLAVE_DIA_DEMO, hoy);
    localStorage.setItem(CLAVE_VERSION_DEMO, VERSION_DEMO);
    return nuevos;
  } catch {
    return crearDatosDemo(hoy);
  }
}

export function cargarDatos(): DatosGranja {
  if (esDemo()) return cargarDemo();

  const guardados = leerDatos();
  const migrados = migrarDatos(guardados);

  if (JSON.stringify(migrados) !== JSON.stringify(guardados)) {
    if (!localStorage.getItem(CLAVE_RESPALDO)) {
      localStorage.setItem(CLAVE_RESPALDO, JSON.stringify({ ...guardados, guardadoEn: new Date().toISOString() }));
    }
    escribirDatos(migrados);
  }
  return migrados;
}

// ---------------------------------------------------------------- sincronización
// Solo modo real: cola de ids pendientes de subir, conflictos y cursor de bajada.
export type TablaNube = 'madres' | 'ciclos';
export interface ColaPendientes { madres: string[]; ciclos: string[] }
export interface Conflicto { tabla: TablaNube; id: string; error: string; fecha: string }
export interface CursorNube { madres?: string; ciclos?: string }

const CLAVE_TABLA: Record<TablaNube, string> = { madres: CLAVES.MADRES, ciclos: CLAVES.CICLOS };

function leerJSON<T>(nombre: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(nombre);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function leerCola(): ColaPendientes {
  const c = leerJSON<Partial<ColaPendientes>>(CLAVE_PENDIENTES, {});
  return { madres: Array.isArray(c.madres) ? c.madres : [], ciclos: Array.isArray(c.ciclos) ? c.ciclos : [] };
}

function escribirCola(cola: ColaPendientes) {
  try {
    if (cola.madres.length || cola.ciclos.length) localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(cola));
    else localStorage.removeItem(CLAVE_PENDIENTES);
  } catch (error) {
    console.error('Error guardando cola de sincronización:', error);
  }
}

export function contarPendientes(): number {
  const c = leerCola();
  return c.madres.length + c.ciclos.length;
}

export function quitarDeCola(tabla: TablaNube, id: string) {
  const cola = leerCola();
  cola[tabla] = cola[tabla].filter(x => x !== id);
  escribirCola(cola);
}

export function leerConflictos(): Conflicto[] {
  const lista = leerJSON<unknown>(CLAVE_CONFLICTOS, []);
  return Array.isArray(lista) ? (lista as Conflicto[]) : [];
}

export function agregarConflicto(conflicto: Conflicto) {
  const resto = leerConflictos().filter(c => !(c.tabla === conflicto.tabla && c.id === conflicto.id));
  try {
    localStorage.setItem(CLAVE_CONFLICTOS, JSON.stringify([...resto, conflicto]));
  } catch (error) {
    console.error('Error guardando conflictos:', error);
  }
}

export function leerCursor(granjaId: string): CursorNube {
  return leerJSON<CursorNube>(PREFIJO_CURSOR + granjaId, {});
}

export function guardarCursor(granjaId: string, cursor: CursorNube) {
  try {
    localStorage.setItem(PREFIJO_CURSOR + granjaId, JSON.stringify(cursor));
  } catch (error) {
    console.error('Error guardando cursor de sincronización:', error);
  }
}

// Lee la lista real de la tabla (la sincronización solo corre en modo real).
export function leerListaTabla<T extends { id: string }>(tabla: TablaNube): T[] {
  return leerLista<T>(clave(CLAVE_TABLA[tabla]));
}

// Escribe lo bajado de la nube sin volver a encolarlo.
export function escribirListaSinEncolar(tabla: TablaNube, lista: unknown[]) {
  localStorage.setItem(clave(CLAVE_TABLA[tabla]), JSON.stringify(lista));
}

// Ids de la lista nueva que no estaban o cambiaron respecto de lo guardado.
function idsCambiados(nombre: string, lista: unknown[]): string[] {
  const previo = new Map<string, string>();
  leerJSON<unknown[]>(clave(nombre), []).forEach(x => {
    const id = (x as { id?: unknown })?.id;
    if (typeof id === 'string') previo.set(id, JSON.stringify(x));
  });
  const cambiados: string[] = [];
  lista.forEach(x => {
    const id = (x as { id?: unknown })?.id;
    if (typeof id === 'string' && previo.get(id) !== JSON.stringify(x)) cambiados.push(id);
  });
  return cambiados;
}

export function guardarLista(nombre: string, lista: unknown[]) {
  try {
    // Solo en modo real y solo madres/ciclos se encolan para la nube.
    const tabla: TablaNube | null =
      esDemo() ? null : nombre === CLAVES.MADRES ? 'madres' : nombre === CLAVES.CICLOS ? 'ciclos' : null;
    const cambiados = tabla ? idsCambiados(nombre, lista) : [];
    localStorage.setItem(clave(nombre), JSON.stringify(lista));
    if (tabla && cambiados.length) {
      const cola = leerCola();
      cola[tabla] = Array.from(new Set([...cola[tabla], ...cambiados]));
      escribirCola(cola);
    }
  } catch (error) {
    console.error('Error guardando datos:', error);
  }
}

export const VERSION_COPIA = '2.0';

// Copia completa: misma forma que acepta importarDatos ({madres, ciclos}) más metadatos.
export function armarCopia(madres: Madre[], ciclos: Ciclo[], granja?: string | null) {
  return {
    formato: 'porcicontrol-copia',
    version: VERSION_COPIA,
    fechaCopia: hoyISO(),
    exportDate: new Date().toISOString(),
    ...(granja ? { granja } : {}),
    madres,
    ciclos,
  };
}

export function nombreArchivoCopia(): string {
  return `porcicontrol-copia-${hoyISO()}.json`;
}

export function importarDatos(datos: { madres: Madre[]; ciclos: Ciclo[] }) {
  const migrados = migrarDatos({ madres: datos.madres, ciclos: datos.ciclos, alertas: [] });
  // guardarLista encola lo importado para la nube (solo en modo real).
  guardarLista(CLAVES.MADRES, migrados.madres);
  guardarLista(CLAVES.CICLOS, migrados.ciclos);
}

// Granja a la que pertenecen los datos locales: impide subirlos a otra granja.
const CLAVE_GRANJA_DATOS = 'granja_datos_de';

export function leerGranjaDeDatos(): string | null {
  try {
    return localStorage.getItem(CLAVE_GRANJA_DATOS);
  } catch {
    return null;
  }
}

export function marcarGranjaDeDatos(granjaId: string) {
  localStorage.setItem(CLAVE_GRANJA_DATOS, granjaId);
}

export function hayDatosLocalesNube(): boolean {
  return leerListaTabla('madres').length > 0 || leerListaTabla('ciclos').length > 0 || contarPendientes() > 0;
}

export function borrarDatos() {
  if (esDemo()) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIJO_DEMO))
      .forEach(k => localStorage.removeItem(k));
    return;
  }
  [CLAVES.MADRES, CLAVES.CICLOS, CLAVES.ALERTAS, CLAVE_RESPALDO, CLAVE_PENDIENTES, CLAVE_CONFLICTOS, CLAVE_GRANJA_DATOS].forEach(k =>
    localStorage.removeItem(k)
  );
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIJO_CURSOR))
    .forEach(k => localStorage.removeItem(k));
}

export function leerPreferencia(nombre: string): string | null {
  try {
    return localStorage.getItem(clave(nombre));
  } catch {
    return null;
  }
}

export function guardarPreferencia(nombre: string, valor: string) {
  try {
    localStorage.setItem(clave(nombre), valor);
  } catch {
    // Sin almacenamiento, la preferencia dura solo mientras la pantalla esté abierta.
  }
}
