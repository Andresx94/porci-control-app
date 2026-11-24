import { Alerta, Ciclo, Madre } from '@/types';
import { aFechaPura, diaLocal, hoyISO } from '@/lib/fechas';
import { crearDatosDemo, DatosGranja, VERSION_DEMO } from '@/lib/demo';

export const CLAVES = {
  MADRES: 'granja_madres',
  CICLOS: 'granja_ciclos',
  ALERTAS: 'granja_alertas',
};

const CLAVE_RESPALDO = 'granja_respaldo_antes_fechas';
const PREFIJO_DEMO = 'demo_';
const CLAVE_DIA_DEMO = `${PREFIJO_DEMO}dia`;
const CLAVE_VERSION_DEMO = `${PREFIJO_DEMO}version`;

// La app abre en demo. Los datos reales siguen en sus claves de siempre y solo se
// usan con ?real=1; la demo guarda todo con el prefijo demo_.
export function esDemo(): boolean {
  return new URLSearchParams(window.location.search).get('real') !== '1';
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

export function guardarLista(nombre: string, lista: unknown[]) {
  try {
    localStorage.setItem(clave(nombre), JSON.stringify(lista));
  } catch (error) {
    console.error('Error guardando datos:', error);
  }
}

export function importarDatos(datos: { madres: Madre[]; ciclos: Ciclo[] }) {
  const migrados = migrarDatos({ madres: datos.madres, ciclos: datos.ciclos, alertas: [] });
  localStorage.setItem(clave(CLAVES.MADRES), JSON.stringify(migrados.madres));
  localStorage.setItem(clave(CLAVES.CICLOS), JSON.stringify(migrados.ciclos));
}

export function borrarDatos() {
  if (esDemo()) {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIJO_DEMO))
      .forEach(k => localStorage.removeItem(k));
    return;
  }
  [CLAVES.MADRES, CLAVES.CICLOS, CLAVES.ALERTAS, CLAVE_RESPALDO].forEach(k => localStorage.removeItem(k));
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
