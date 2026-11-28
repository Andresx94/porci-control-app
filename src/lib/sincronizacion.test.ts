import { beforeEach, describe, expect, it } from 'vitest';
import { Ciclo, Madre } from '@/types';
import { CLAVES, contarPendientes, guardarLista, importarDatos, leerCola, leerConflictos, leerCursor, borrarDatos, reintentarConflictos } from '@/lib/datos';
import {
  cicloANube,
  cicloDeNube,
  ErrorRed,
  Fila,
  madreANube,
  madreDeNube,
  Remoto,
  sincronizar,
} from '@/lib/sincronizacion';
import { generarUuid } from '@/lib/utils';

const G = '11111111-1111-4111-8111-111111111111';
const M1 = '22222222-2222-4222-8222-222222222221';
const M2 = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333331';

const madreCompleta: Madre = {
  id: M1,
  arete: 'A-1',
  fechaNacimiento: '2024-01-05',
  estado: 'descartada',
  observaciones: 'obs',
  fechaRegistro: '2025-02-01',
  registradoEn: '2025-02-01T10:00:00.000Z',
  fechaDescarte: '2026-03-01',
  descartadoEn: '2026-03-01T12:00:00.000Z',
  motivoDescarte: 'vieja',
  areteMadre: 'A-0',
  aretePadre: 'V-9',
};

const cicloCompleto: Ciclo = {
  id: C1,
  madreId: M1,
  numeroCiclo: 2,
  fechaCruce: '2026-01-01',
  tipoCruce: 'inseminacion',
  numeroVerraco: 'V-1',
  intento: 2,
  observacionesCruce: 'oc',
  fechaPartoPrevista: '2026-04-26',
  fechaVacunaSuicen: '2026-04-11',
  fechaEnjaule: '2026-04-21',
  fechaDestetePrevista: '2026-05-26',
  fechaSiguienteMonta: '2026-05-31',
  fechaPartoReal: '2026-04-27',
  nacidosTotales: 12,
  nacidosVivos: 10,
  nacidosMuertos: 1,
  momias: 1,
  observacionesParto: 'op',
  fechaDestete: '2026-05-27',
  destetados: 9,
  muertesLactancia: 1,
  pesoPromedioNacimiento: 1.35,
  pesoPromedioDestete: 7.8,
  observacionesDestete: 'od',
  fechaFallo: '2026-02-01',
  motivoFallo: 'repitio_celo',
  observacionesFallo: 'of',
  estadoCiclo: 'fallido',
  fechaCreacion: '2026-01-01T08:00:00.000Z',
  fechaActualizacion: '2026-01-02T08:00:00.000Z',
};

const madre = (id: string, arete: string, extra: Partial<Madre> = {}): Madre => ({
  id, arete, estado: 'activa', fechaRegistro: '2026-01-01', ...extra,
});

// Remoto en memoria: pone actualizado_en como el servidor y exige arete único.
function crearRemoto() {
  const tablas: Record<'madres' | 'ciclos', Map<string, Fila>> = { madres: new Map(), ciclos: new Map() };
  let reloj = Date.parse('2026-06-01T00:00:00Z');
  const estado = { caida: false, llamadasBajar: [] as (string | null)[], subidas: 0 };

  const remoto: Remoto = {
    async subir(tabla, filas) {
      if (estado.caida) throw new ErrorRed('sin red');
      return filas.map(f => {
        const id = f.id as string;
        if (tabla === 'madres') {
          const choca = [...tablas.madres.values()].some(x => x.arete === f.arete && x.id !== id && !x.borrado_en);
          if (choca) return { id, error: 'duplicate key value violates unique constraint "madres_arete_uq"' };
        }
        estado.subidas++;
        reloj += 1000;
        tablas[tabla].set(id, { ...f, actualizado_en: new Date(reloj).toISOString().replace('Z', '+00:00'), borrado_en: null });
        return { id };
      });
    },
    async bajar(tabla, granjaId, desde) {
      if (estado.caida) throw new ErrorRed('sin red');
      estado.llamadasBajar.push(desde);
      return [...tablas[tabla].values()]
        .filter(f => f.granja_id === granjaId && (!desde || Date.parse(f.actualizado_en as string) >= Date.parse(desde)))
        .sort((a, b) => Date.parse(a.actualizado_en as string) - Date.parse(b.actualizado_en as string));
    },
  };
  // Cambio hecho por otro dispositivo directamente en el servidor.
  const otroDispositivo = (tabla: 'madres' | 'ciclos', fila: Fila) => {
    reloj += 1000;
    tablas[tabla].set(fila.id as string, { borrado_en: null, ...fila, actualizado_en: new Date(reloj).toISOString() });
  };
  return { remoto, tablas, estado, otroDispositivo };
}

const guardadas = (clave: string): { id: string }[] => JSON.parse(localStorage.getItem(clave) ?? '[]');

describe('mapeo', () => {
  it('madre completa ida y vuelta', () => {
    const fila = madreANube(madreCompleta, G);
    expect(fila.granja_id).toBe(G);
    expect(fila).not.toHaveProperty('actualizado_en');
    expect(fila).not.toHaveProperty('actualizado_por');
    expect(fila).not.toHaveProperty('borrado_en');
    expect(madreDeNube({ ...fila, actualizado_en: '2026-06-01T00:00:00+00:00' })).toEqual(madreCompleta);
  });

  it('ciclo completo ida y vuelta (fallo y pesos incluidos)', () => {
    const fila = cicloANube(cicloCompleto, G);
    expect(fila).toMatchObject({ madre_id: M1, fecha_fallo: '2026-02-01', motivo_fallo: 'repitio_celo', peso_promedio_destete: 7.8 });
    expect(fila.creado_en).toBe(cicloCompleto.fechaCreacion);
    expect(fila).not.toHaveProperty('actualizado_en');
    expect(fila).not.toHaveProperty('borrado_en');
    const vuelta = cicloDeNube({ ...fila, actualizado_en: '2026-01-02T08:00:00.000000+00:00' });
    expect(vuelta).toEqual(cicloCompleto);
  });

  it('undefined sube como null y null baja omitido', () => {
    const fila = madreANube(madre(M1, 'A-2'), G);
    expect(fila.fecha_nacimiento).toBeNull();
    expect(fila.arete_padre).toBeNull();
    expect(madreDeNube(fila)).not.toHaveProperty('aretePadre');

    const c = cicloANube({ ...cicloCompleto, pesoPromedioDestete: undefined, motivoFallo: undefined }, G);
    expect(c.peso_promedio_destete).toBeNull();
    expect(c.motivo_fallo).toBeNull();
    const vuelta = cicloDeNube({ ...c, actualizado_en: '2026-01-02T08:00:00Z' });
    expect('pesoPromedioDestete' in vuelta).toBe(false);
    expect('motivoFallo' in vuelta).toBe(false);
  });

  it('numeric que llega como texto pasa a número', () => {
    const f = { ...cicloANube(cicloCompleto, G), peso_promedio_nacimiento: '1.35', actualizado_en: '2026-01-02T08:00:00Z' };
    expect(cicloDeNube(f).pesoPromedioNacimiento).toBe(1.35);
  });

  it('generarUuid devuelve un uuid v4', () => {
    expect(generarUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('cola en datos.ts', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?demo=1');
  });

  it('en modo real encola nuevos y cambiados, no los iguales', () => {
    window.history.replaceState({}, '', '/?real=1');
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    expect(leerCola()).toEqual({ madres: [M1], ciclos: [] });

    localStorage.removeItem('granja_pendientes');
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]); // sin cambios
    expect(contarPendientes()).toBe(0);

    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1', { observaciones: 'x' }), madre(M2, 'A-2')]);
    expect(leerCola().madres.sort()).toEqual([M1, M2].sort());
    guardarLista(CLAVES.ALERTAS, [{ id: 'a' }]); // las alertas no se encolan
    expect(contarPendientes()).toBe(2);
  });

  it('en demo no encola nunca', () => {
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    guardarLista(CLAVES.CICLOS, [cicloCompleto]);
    expect(localStorage.getItem('granja_pendientes')).toBeNull();
    expect(contarPendientes()).toBe(0);
  });

  it('borrarDatos en real limpia cola, conflictos y cursores', () => {
    window.history.replaceState({}, '', '/?real=1');
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    localStorage.setItem('granja_conflictos', '[]');
    localStorage.setItem(`granja_sync_${G}`, '{}');
    borrarDatos();
    expect(localStorage.getItem('granja_pendientes')).toBeNull();
    expect(localStorage.getItem('granja_conflictos')).toBeNull();
    expect(localStorage.getItem(`granja_sync_${G}`)).toBeNull();
  });
});

describe('sincronizar', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?real=1');
  });

  it('en demo no hace nada', async () => {
    window.history.replaceState({}, '', '/?demo=1');
    const { remoto, estado } = crearRemoto();
    const r = await sincronizar(remoto, G);
    expect(r).toEqual({ subidas: 0, bajadas: 0, conflictos: 0, cambiosLocales: false });
    expect(estado.llamadasBajar).toHaveLength(0);
  });

  it('sube pendientes (madres antes que ciclos) y vacía la cola', async () => {
    const { remoto, tablas } = crearRemoto();
    guardarLista(CLAVES.CICLOS, [{ ...cicloCompleto }]);
    guardarLista(CLAVES.MADRES, [madreCompleta]);
    const r = await sincronizar(remoto, G);
    expect(r.subidas).toBe(2);
    expect(contarPendientes()).toBe(0);
    expect(tablas.madres.get(M1)?.arete).toBe('A-1');
    expect(tablas.ciclos.get(C1)?.madre_id).toBe(M1);
  });

  it('no sube datos locales de una granja a otra', async () => {
    const { remoto, tablas } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1', { observaciones: 'cambio' })]);
    await expect(sincronizar(remoto, 'otra-granja')).rejects.toThrow('otra granja');
    expect(contarPendientes()).toBe(1);
    expect(tablas.madres.get(M1)?.granja_id).toBe(G);
  });

  it('reintentar conflictos los vuelve a encolar y limpia la lista', async () => {
    const { remoto, otroDispositivo } = crearRemoto();
    otroDispositivo('madres', madreANube(madre(M2, 'A-1'), G));
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);
    expect(leerConflictos()).toHaveLength(1);
    expect(reintentarConflictos()).toBe(1);
    expect(leerConflictos()).toHaveLength(0);
    expect(leerCola().madres).toEqual([M1]);
  });

  it('importar en modo real encola todo', () => {
    importarDatos({ madres: [madre(M1, 'A-1'), madre(M2, 'A-2')], ciclos: [{ ...cicloCompleto }] });
    expect(leerCola()).toEqual({ madres: [M1, M2], ciclos: [C1] });
  });

  it('error de fila: conflicto, fuera de la cola y dato local intacto', async () => {
    const { remoto, otroDispositivo } = crearRemoto();
    otroDispositivo('madres', madreANube(madre(M2, 'A-1'), G)); // mismo arete en la nube
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    const r = await sincronizar(remoto, G);
    expect(r.conflictos).toBe(1);
    expect(contarPendientes()).toBe(0);
    const conf = leerConflictos();
    expect(conf).toHaveLength(1);
    expect(conf[0]).toMatchObject({ tabla: 'madres', id: M1 });
    expect(conf[0].error).toContain('madres_arete_uq');
    expect(guardadas(CLAVES.MADRES).find(m => m.id === M1)).toMatchObject({ arete: 'A-1' });
  });

  it('error de red: la cola queda intacta', async () => {
    const { remoto, estado } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    estado.caida = true;
    await expect(sincronizar(remoto, G)).rejects.toBeInstanceOf(ErrorRed);
    expect(leerCola().madres).toEqual([M1]);
    expect(leerConflictos()).toHaveLength(0);
    estado.caida = false;
    await sincronizar(remoto, G);
    expect(contarPendientes()).toBe(0);
  });

  it('un cambio hecho mientras sube sigue en cola', async () => {
    const { remoto } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    const subirOriginal = remoto.subir.bind(remoto);
    remoto.subir = async (t, f) => {
      const res = await subirOriginal(t, f);
      guardarLista(CLAVES.MADRES, [madre(M1, 'A-1', { observaciones: 'nuevo' })]);
      return res;
    };
    await sincronizar(remoto, G);
    expect(leerCola().madres).toEqual([M1]);
  });

  it('la bajada agrega y reemplaza, y escribe sin encolar', async () => {
    const { remoto, otroDispositivo } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);

    otroDispositivo('madres', madreANube(madre(M1, 'A-1', { observaciones: 'desde otro' }), G));
    otroDispositivo('madres', madreANube(madre(M2, 'A-2'), G));
    const r = await sincronizar(remoto, G);
    expect(r.cambiosLocales).toBe(true);
    expect(r.bajadas).toBe(2);
    const lista = guardadas(CLAVES.MADRES) as Madre[];
    expect(lista).toHaveLength(2);
    expect(lista.find(m => m.id === M1)?.observaciones).toBe('desde otro');
    expect(contarPendientes()).toBe(0);
  });

  it('la bajada no pisa lo local pendiente', async () => {
    const { remoto, otroDispositivo, estado } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);

    otroDispositivo('madres', madreANube(madre(M1, 'A-1', { observaciones: 'remoto' }), G));
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1', { observaciones: 'local' })]);
    estado.caida = false;
    // Se simula un fallo al subir para que quede pendiente durante la bajada.
    const subirOriginal = remoto.subir.bind(remoto);
    remoto.subir = async () => { throw new ErrorRed('x'); };
    await expect(sincronizar(remoto, G)).rejects.toBeInstanceOf(ErrorRed);
    remoto.subir = subirOriginal;
    expect((guardadas(CLAVES.MADRES) as Madre[])[0].observaciones).toBe('local');
    expect(leerCola().madres).toEqual([M1]);
  });

  it('bajada con pendiente: no se pisa aunque suba y baje en la misma vuelta', async () => {
    const { remoto, otroDispositivo } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);
    otroDispositivo('madres', madreANube(madre(M2, 'A-2'), G));
    // Un cambio local llega mientras se sube otra cosa: queda pendiente y no se pisa.
    guardarLista(CLAVES.CICLOS, [cicloCompleto]);
    const bajarOriginal = remoto.bajar.bind(remoto);
    remoto.bajar = async (t, g, d) => {
      const filas = await bajarOriginal(t, g, d);
      if (t === 'madres') {
        guardarLista(CLAVES.MADRES, [madre(M1, 'A-1', { observaciones: 'mientras baja' }), ...(guardadas(CLAVES.MADRES).slice(1) as Madre[])]);
        filas.forEach(f => { if (f.id === M1) f.observaciones = 'remoto'; });
      }
      return filas;
    };
    await sincronizar(remoto, G);
    const lista = guardadas(CLAVES.MADRES) as Madre[];
    expect(lista.find(m => m.id === M1)?.observaciones).toBe('mientras baja');
    expect(lista.find(m => m.id === M2)).toBeTruthy();
  });

  it('quita lo borrado en la nube', async () => {
    const { remoto, otroDispositivo } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1'), madre(M2, 'A-2')]);
    await sincronizar(remoto, G);
    otroDispositivo('madres', { ...madreANube(madre(M2, 'A-2'), G), borrado_en: '2026-06-02T00:00:00Z' });
    const r = await sincronizar(remoto, G);
    expect(r.cambiosLocales).toBe(true);
    expect(guardadas(CLAVES.MADRES).map(m => m.id)).toEqual([M1]);
    expect(contarPendientes()).toBe(0);
  });

  it('guarda el cursor por granja y lo usa restando 5 minutos', async () => {
    const { remoto, tablas, estado } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madre(M1, 'A-1')]);
    await sincronizar(remoto, G);
    const maximo = tablas.madres.get(M1)?.actualizado_en as string;
    expect(leerCursor(G).madres).toBe(maximo);
    expect(localStorage.getItem(`granja_sync_${G}`)).toContain(maximo);

    await sincronizar(remoto, G);
    const ultimo = estado.llamadasBajar[estado.llamadasBajar.length - 2]; // consulta de madres
    expect(Date.parse(maximo) - Date.parse(ultimo as string)).toBe(5 * 60 * 1000);
  });

  it('segunda sincronización sin cambios no hace nada', async () => {
    const { remoto, estado } = crearRemoto();
    guardarLista(CLAVES.MADRES, [madreCompleta]);
    guardarLista(CLAVES.CICLOS, [cicloCompleto]);
    await sincronizar(remoto, G);
    await sincronizar(remoto, G); // la nube devuelve lo propio con sello del servidor
    const antes = estado.subidas;
    const r = await sincronizar(remoto, G);
    expect(r).toEqual({ subidas: 0, bajadas: 0, conflictos: 0, cambiosLocales: false });
    expect(estado.subidas).toBe(antes);
    expect(contarPendientes()).toBe(0);
  });
});
