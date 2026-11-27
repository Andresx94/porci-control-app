import { describe, expect, it } from 'vitest';
import { Accion, cicloVacioPara, puede } from '@/lib/permisos';
import type { Ciclo } from '@/types';

const TODAS: Accion[] = [
  'ver', 'crearMadre', 'editarMadre', 'descartarMadre', 'crearCruce', 'editarCruce',
  'registrarParto', 'registrarDestete', 'registrarFallo', 'verReportes',
  'exportarImportar', 'borrarDatos', 'verDemo', 'gestionarTrabajadores', 'verAjustesGranja',
];

describe('puede', () => {
  it('dueño y sin rol (demo / sin nube) pueden todo', () => {
    for (const a of TODAS) {
      expect(puede('dueno', a)).toBe(true);
      expect(puede(null, a)).toBe(true);
    }
  });

  it('el trabajador solo ve, crea cruces y registra parto, destete y fallo', () => {
    const permitidas = TODAS.filter(a => puede('operario', a));
    expect(permitidas.sort()).toEqual(['crearCruce', 'registrarDestete', 'registrarFallo', 'registrarParto', 'ver']);
  });

  it('el trabajador no crea madres, no edita, no descarta ni ve reportes o trabajadores', () => {
    for (const a of ['crearMadre', 'editarMadre', 'descartarMadre', 'editarCruce', 'verReportes',
      'exportarImportar', 'borrarDatos', 'verDemo', 'gestionarTrabajadores', 'verAjustesGranja'] as Accion[]) {
      expect(puede('operario', a)).toBe(false);
    }
  });
});

describe('cicloVacioPara', () => {
  const base = { id: '1', madreId: 'm', numeroCiclo: 1, intento: 1, fechaCruce: '2026-01-01', tipoCruce: 'monta_natural' } as Ciclo;

  it('parto solo en gestación sin parto registrado', () => {
    expect(cicloVacioPara('registrarParto', { ...base, estadoCiclo: 'gestacion' })).toBe(true);
    expect(cicloVacioPara('registrarParto', { ...base, estadoCiclo: 'gestacion', fechaPartoReal: '2026-04-25' })).toBe(false);
    expect(cicloVacioPara('registrarParto', { ...base, estadoCiclo: 'lactancia' })).toBe(false);
  });

  it('destete solo en lactancia sin destete registrado', () => {
    expect(cicloVacioPara('registrarDestete', { ...base, estadoCiclo: 'lactancia' })).toBe(true);
    expect(cicloVacioPara('registrarDestete', { ...base, estadoCiclo: 'lactancia', fechaDestete: '2026-05-20' })).toBe(false);
  });

  it('fallo solo en gestación sin fallo registrado', () => {
    expect(cicloVacioPara('registrarFallo', { ...base, estadoCiclo: 'gestacion' })).toBe(true);
    expect(cicloVacioPara('registrarFallo', { ...base, estadoCiclo: 'fallido', fechaFallo: '2026-02-01' })).toBe(false);
  });
});
