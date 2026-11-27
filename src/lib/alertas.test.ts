import { describe, expect, it } from 'vitest';
import { calcularAlertas } from './alertas';
import { Ciclo, Madre } from '@/types';

const madre = (id: string, extra: Partial<Madre> = {}): Madre => ({
  id, arete: 'A' + id, estado: 'gestacion', fechaRegistro: '2026-01-01', ...extra,
});
const ciclo = (id: string, madreId: string, extra: Partial<Ciclo> = {}): Ciclo => ({
  id, madreId, numeroCiclo: 1, fechaCruce: '2026-01-01', tipoCruce: 'monta_natural', intento: 1,
  estadoCiclo: 'gestacion', fechaCreacion: '', fechaActualizacion: '', ...extra,
});
const HOY = '2026-06-10';

describe('calcularAlertas', () => {
  it('avisa parto próximo dentro de 7 días', () => {
    const r = calcularAlertas([madre('1')], [ciclo('c1', '1', { fechaPartoPrevista: '2026-06-15' })], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: 'parto_proximo', prioridad: 'alta', mensaje: 'A1 próxima a parir' });
  });

  it('error 1: parto atrasado genera alerta alta con los días', () => {
    const r = calcularAlertas([madre('1')], [ciclo('c1', '1', { fechaPartoPrevista: '2026-06-07' })], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ prioridad: 'alta', mensaje: 'A1: parto atrasado 3 días' });
  });

  it('error 2: excluye madres descartadas y ciclos no vigentes', () => {
    const r = calcularAlertas(
      [madre('1', { estado: 'descartada' }), madre('2', { estado: 'vacia' })],
      [
        ciclo('c1', '1', { fechaPartoPrevista: '2026-06-07' }),
        ciclo('c2', '2', { estadoCiclo: 'fallido', fechaPartoPrevista: '2026-06-07' }),
        ciclo('c3', '2', { estadoCiclo: 'finalizado', fechaPartoPrevista: '2026-06-07', fechaDestete: '2026-06-09' }),
      ],
      [], HOY,
    );
    expect(r).toEqual([]);
  });

  it('error 3: cada ciclo genera sus alertas aunque el anterior esté leído', () => {
    const c1 = ciclo('c1', '1', { fechaPartoPrevista: '2026-06-12' });
    const primera = calcularAlertas([madre('1')], [c1], [], HOY).map(a => ({ ...a, leida: true }));
    const c2 = ciclo('c2', '1', { numeroCiclo: 2, fechaPartoPrevista: '2026-12-12' });
    const r = calcularAlertas([madre('1')], [{ ...c1, estadoCiclo: 'finalizado' }, c2], primera, '2026-12-10');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('parto_proximo:c2');
    expect(r[0].leida).toBe(false);
  });

  it('no duplica y conserva leida', () => {
    const cs = [ciclo('c1', '1', { fechaPartoPrevista: '2026-06-12' })];
    const a1 = calcularAlertas([madre('1')], cs, [], HOY);
    const leidas = a1.map(a => ({ ...a, leida: true }));
    const a2 = calcularAlertas([madre('1')], cs, leidas, HOY);
    expect(a2).toHaveLength(1);
    expect(a2[0].leida).toBe(true);
    expect(a2[0].id).toBe(a1[0].id);
  });

  it('leida no se conserva si cambió la fecha del parto', () => {
    const previa = calcularAlertas([madre('1')], [ciclo('c1', '1', { fechaPartoPrevista: '2026-06-12' })], [], HOY)
      .map(a => ({ ...a, leida: true }));
    const r = calcularAlertas([madre('1')], [ciclo('c1', '1', { fechaPartoPrevista: '2026-06-14' })], previa, HOY);
    expect(r[0].leida).toBe(false);
  });

  it('destete pendiente y atrasado en lactancia', () => {
    const m = [madre('1', { estado: 'lactancia' })];
    const pronto = calcularAlertas(m, [ciclo('c1', '1', { estadoCiclo: 'lactancia', fechaDestetePrevista: '2026-06-13' })], [], HOY);
    expect(pronto[0]).toMatchObject({ tipo: 'destete_pendiente', mensaje: 'A1 lista para destete' });
    const tarde = calcularAlertas(m, [ciclo('c1', '1', { estadoCiclo: 'lactancia', fechaDestetePrevista: '2026-06-08' })], [], HOY);
    expect(tarde[0].mensaje).toBe('A1: destete atrasado 2 días');
  });

  it('lista para cruce: por ciclo finalizado, solo sin ciclo activo y tras 7 días', () => {
    const fin = ciclo('c1', '1', { estadoCiclo: 'finalizado', fechaDestete: '2026-06-01' });
    const m = [madre('1', { estado: 'vacia' })];
    expect(calcularAlertas(m, [fin], [], HOY)[0].id).toBe('lista_cruce:c1');
    expect(calcularAlertas(m, [fin], [], '2026-06-05')).toEqual([]);
    expect(calcularAlertas(m, [fin, ciclo('c2', '1', { estadoCiclo: 'cruce' })], [], HOY)).toEqual([]);
  });

  it('último ciclo fallido sin ciclo activo: lista para volver a cruzar', () => {
    const fin = ciclo('c1', '1', { estadoCiclo: 'finalizado', fechaDestete: '2026-01-01' });
    const fallido = ciclo('c2', '1', { numeroCiclo: 2, estadoCiclo: 'fallido', fechaFallo: '2026-06-09' });
    const m = [madre('1', { estado: 'vacia' })];
    const r = calcularAlertas(m, [fin, fallido], [], HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: 'lista_cruce:c2', prioridad: 'media', fechaAlerta: '2026-06-09', mensaje: 'A1: lista para volver a cruzar',
    });
    const activo = ciclo('c3', '1', { numeroCiclo: 2, intento: 2, estadoCiclo: 'gestacion', fechaPartoPrevista: '2026-10-01' });
    expect(calcularAlertas(m, [fin, fallido, activo], [], HOY)).toEqual([]);
    expect(calcularAlertas([madre('1', { estado: 'descartada' })], [fin, fallido], [], HOY)).toEqual([]);
  });
});
