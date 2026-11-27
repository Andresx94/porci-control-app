import { beforeEach, describe, expect, it } from 'vitest';
import { armarCopia, borrarDatos, cargarDatos, importarDatos, nombreArchivoCopia } from '@/lib/datos';
import { crearDatosDemo } from '@/lib/demo';
import { hoyISO } from '@/lib/fechas';

describe('copia completa', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?demo=1');
  });

  it('nombre con fecha de hoy', () => {
    expect(nombreArchivoCopia()).toBe(`porcicontrol-copia-${hoyISO()}.json`);
  });

  it('trae metadatos y granja opcional', () => {
    const { madres, ciclos } = crearDatosDemo(hoyISO());
    const c = armarCopia(madres, ciclos, 'Granja Norte');
    expect(c.version).toBe('2.0');
    expect(c.fechaCopia).toBe(hoyISO());
    expect(c.granja).toBe('Granja Norte');
    expect('granja' in armarCopia(madres, ciclos)).toBe(false);
  });

  it('se puede reimportar sin perder madres ni ciclos', () => {
    const { madres, ciclos } = crearDatosDemo(hoyISO());
    expect(madres.length).toBeGreaterThan(0);
    const texto = JSON.stringify(armarCopia(madres, ciclos, 'G'));
    borrarDatos();
    importarDatos(JSON.parse(texto));
    const datos = cargarDatos();
    expect(datos.madres.map(m => m.id).sort()).toEqual(madres.map(m => m.id).sort());
    expect(datos.ciclos.map(c => c.id).sort()).toEqual(ciclos.map(c => c.id).sort());
  });
});
