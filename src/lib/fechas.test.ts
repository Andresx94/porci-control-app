import { beforeEach, describe, expect, it } from 'vitest';
import { Ciclo, Madre } from '@/types';
import { calcularFechasCiclo, diaLocal, diasEntre, esFechaPura, formatFecha, sumarDias } from '@/lib/fechas';
import { borrarDatos, cargarDatos, CLAVES, guardarLista, migrarDatos } from '@/lib/datos';
import { crearDatosDemo, VERSION_DEMO } from '@/lib/demo';
import { siguienteCiclo } from '@/lib/ciclos';

const usarDemo = (activa: boolean) => window.history.replaceState(null, '', activa ? '/' : '/?real=1');

describe(`fechas en ${process.env.TZ ?? 'zona del sistema'}`, () => {
  beforeEach(() => {
    usarDemo(false);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('muestra el mismo día guardado', () => {
    expect(formatFecha('2026-07-25')).toBe('25/7/2026');
    expect(formatFecha('2024-02-29')).toBe('29/2/2024');
    expect(formatFecha(undefined)).toBe('—');
  });

  it('calcula sin que el cambio de horario mueva el día', () => {
    expect(sumarDias('2026-03-07', 2)).toBe('2026-03-09');
    expect(sumarDias('2026-10-24', 2)).toBe('2026-10-26');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(diasEntre('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('calcula las fechas del ciclo', () => {
    expect(calcularFechasCiclo('2026-08-05')).toEqual({
      fechaPartoPrevista: '2026-11-28',
      fechaVacunaSuicen: '2026-11-13',
      fechaEnjaule: '2026-11-23',
      fechaDestetePrevista: '2026-12-28',
      fechaSiguienteMonta: '2027-01-02',
    });
  });

  it('toma el día local incluso cerca de medianoche', () => {
    expect(diaLocal(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(diaLocal(new Date(2026, 10, 23, 0, 1))).toBe('2026-11-23');
  });

  it('migra sin mover días, conserva el instante y se puede repetir', () => {
    const registro = new Date(2026, 6, 15, 22, 30).toISOString();
    const descarte = new Date(2026, 8, 1, 0, 30).toISOString();
    const madre = { id: 'm', arete: '1', estado: 'descartada', fechaNacimiento: '2023-04-14', fechaRegistro: registro, fechaDescarte: descarte } as Madre;
    const ciclo = { id: 'c', madreId: 'm', fechaCruce: '2026-07-25', fechaPartoReal: '2026-11-17T00:00:00.000Z', fechaCreacion: registro } as Ciclo;

    const una = migrarDatos({ madres: [madre], ciclos: [ciclo], alertas: [] });
    expect(una.madres[0]).toMatchObject({ fechaNacimiento: '2023-04-14', fechaRegistro: '2026-07-15', registradoEn: registro, fechaDescarte: '2026-09-01', descartadoEn: descarte });
    expect(una.ciclos[0]).toMatchObject({ fechaCruce: '2026-07-25', fechaPartoReal: '2026-11-17', fechaCreacion: registro });
    expect(migrarDatos(una)).toEqual(una);
  });

  it('guarda un respaldo antes de migrar datos reales', () => {
    const original = JSON.stringify([{ id: 'm', arete: '1', estado: 'vacia', fechaRegistro: new Date(2026, 6, 15, 12).toISOString() }]);
    localStorage.setItem(CLAVES.MADRES, original);
    expect(cargarDatos().madres[0].fechaRegistro).toBe('2026-07-15');
    expect(JSON.parse(localStorage.getItem('granja_respaldo_antes_fechas')!).madres).toEqual(JSON.parse(original));
  });

  it('conserva una copia si los datos guardados están dañados', () => {
    localStorage.setItem(CLAVES.MADRES, '{roto');
    expect(cargarDatos().madres).toEqual([]);
    expect(localStorage.getItem(`${CLAVES.MADRES}_danado`)).toBe('{roto');
  });

  it('la demo nunca toca los datos reales', () => {
    const real = JSON.stringify([{ id: 'real', arete: 'R1', estado: 'vacia', fechaRegistro: '2026-01-01' }]);
    localStorage.setItem(CLAVES.MADRES, real);
    usarDemo(true);

    expect(cargarDatos().madres.some(m => m.id === 'real')).toBe(false);
    guardarLista(CLAVES.MADRES, []);
    borrarDatos();

    expect(localStorage.getItem(CLAVES.MADRES)).toBe(real);
    expect(cargarDatos().madres.length).toBeGreaterThan(20);
    expect(localStorage.getItem(CLAVES.MADRES)).toBe(real);
  });

  it('la demo conserva lo editado y se actualiza de día solo si no se tocó', () => {
    usarDemo(true);
    const base = crearDatosDemo('2026-01-10');
    localStorage.setItem('demo_dia', '2026-01-10');
    localStorage.setItem('demo_version', VERSION_DEMO);
    localStorage.setItem(`demo_${CLAVES.MADRES}`, JSON.stringify(base.madres));
    localStorage.setItem(`demo_${CLAVES.CICLOS}`, JSON.stringify(base.ciclos));
    expect(cargarDatos().madres[0].fechaRegistro).not.toBe(base.madres[0].fechaRegistro);

    const editadas = [{ ...base.madres[0], arete: 'EDITADA' }];
    localStorage.setItem('demo_dia', '2026-01-10');
    localStorage.setItem(`demo_${CLAVES.MADRES}`, JSON.stringify(editadas));
    localStorage.setItem(`demo_${CLAVES.CICLOS}`, JSON.stringify(base.ciclos));
    expect(cargarDatos().madres[0].arete).toBe('EDITADA');
  });

  it('después de un intento fallido sigue el mismo ciclo con el intento siguiente', () => {
    const c = (numeroCiclo: number, intento: number, estadoCiclo: Ciclo['estadoCiclo']) => ({ numeroCiclo, intento, estadoCiclo }) as Ciclo;
    expect(siguienteCiclo([])).toEqual({ numeroCiclo: 1, intento: 1 });
    expect(siguienteCiclo([c(1, 1, 'finalizado')])).toEqual({ numeroCiclo: 2, intento: 1 });
    expect(siguienteCiclo([c(1, 1, 'finalizado'), c(2, 1, 'fallido')])).toEqual({ numeroCiclo: 2, intento: 2 });
    expect(siguienteCiclo([c(2, 1, 'fallido'), c(2, 2, 'fallido'), c(1, 1, 'finalizado')])).toEqual({ numeroCiclo: 2, intento: 3 });
    expect(siguienteCiclo([c(2, 1, 'fallido'), c(2, 2, 'finalizado')])).toEqual({ numeroCiclo: 3, intento: 1 });
  });

  it('la demo tiene ciclos coherentes', () => {
    const { madres, ciclos } = crearDatosDemo('2026-03-08');
    expect(new Set(madres.map(m => m.arete)).size).toBe(madres.length);
    expect(new Set(ciclos.map(c => c.id)).size).toBe(ciclos.length);
    ciclos.forEach(c => {
      const madre = madres.find(m => m.id === c.madreId)!;
      expect(madre).toBeDefined();
      expect(madre.fechaRegistro <= c.fechaCruce).toBe(true);
      expect(c.fechaCruce <= '2026-03-08').toBe(true);
      if (c.fechaPartoReal) expect(c.fechaCruce < c.fechaPartoReal).toBe(true);
      if (c.fechaDestete) expect(c.fechaPartoReal! < c.fechaDestete).toBe(true);
      if (c.estadoCiclo === 'fallido') expect(c.fechaFallo! > c.fechaCruce && !!c.motivoFallo).toBe(true);
    });
    madres.filter(m => m.estado === 'gestacion' || m.estado === 'lactancia').forEach(m => {
      expect(ciclos.filter(c => c.madreId === m.id && c.estadoCiclo === m.estado)).toHaveLength(1);
    });
  });

  it('la demo solo usa fechas puras y cubre todos los estados', () => {
    const { madres, ciclos } = crearDatosDemo('2026-03-08');
    const campos = ['fechaCruce', 'fechaPartoPrevista', 'fechaVacunaSuicen', 'fechaEnjaule', 'fechaDestetePrevista', 'fechaSiguienteMonta', 'fechaPartoReal', 'fechaDestete', 'fechaFallo'] as const;
    ciclos.forEach(c => campos.forEach(campo => { if (c[campo]) expect(esFechaPura(c[campo])).toBe(true); }));
    madres.forEach(m => expect(esFechaPura(m.fechaRegistro)).toBe(true));
    expect(new Set(madres.map(m => m.estado))).toEqual(new Set(['activa', 'gestacion', 'lactancia', 'vacia', 'descartada']));
    expect(new Set(ciclos.map(c => c.estadoCiclo))).toEqual(new Set(['gestacion', 'lactancia', 'finalizado', 'fallido']));
  });
});
