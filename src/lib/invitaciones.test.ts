import { describe, expect, it } from 'vitest';
import {
  accesoVigente,
  enlaceInvitacion,
  generarToken,
  hashToken,
  mensajeCanje,
  tokenDeUrl,
  venceAcceso,
  venceEnlace,
} from '@/lib/invitaciones';

describe('generarToken', () => {
  it('es base64url de 32 bytes (43 caracteres) y distinto cada vez', () => {
    const a = generarToken();
    const b = generarToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe('hashToken', () => {
  it('sha256 en hexadecimal minúscula (valor conocido)', async () => {
    expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('64 caracteres hex y estable', async () => {
    const t = generarToken();
    const h = await hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken(t)).toBe(h);
  });
});

describe('enlace y token en la URL', () => {
  it('construye el enlace con origen y base', () => {
    expect(enlaceInvitacion('https://x.github.io', '/porci-control-app/', 'TOKEN')).toBe(
      'https://x.github.io/porci-control-app/?invitacion=TOKEN'
    );
  });

  it('lee el token de la URL si tiene formato válido', () => {
    const t = generarToken();
    expect(tokenDeUrl(`?invitacion=${t}`)).toBe(t);
    expect(tokenDeUrl(`?demo=1&invitacion=${t}`)).toBe(t);
  });

  it('ignora tokens ausentes o con formato raro', () => {
    expect(tokenDeUrl('')).toBeNull();
    expect(tokenDeUrl('?invitacion=')).toBeNull();
    expect(tokenDeUrl('?invitacion=corto')).toBeNull();
    expect(tokenDeUrl('?invitacion=' + 'a/b'.repeat(20))).toBeNull();
  });
});

describe('vencimientos', () => {
  const ahora = new Date('2026-11-27T12:00:00.000Z');

  it('el enlace vale 7 días', () => {
    expect(venceEnlace(ahora).toISOString()).toBe('2026-12-04T12:00:00.000Z');
  });

  it('el acceso vale 30, 45 o 60 días', () => {
    expect(venceAcceso(ahora, 30).toISOString()).toBe('2026-12-27T12:00:00.000Z');
    expect(venceAcceso(ahora, 45).toISOString()).toBe('2027-01-11T12:00:00.000Z');
    expect(venceAcceso(ahora, 60).toISOString()).toBe('2027-01-26T12:00:00.000Z');
  });

  it('accesoVigente: null no vence, pasado vencido, futuro vigente', () => {
    expect(accesoVigente(null, ahora)).toBe(true);
    expect(accesoVigente('2026-11-27T11:59:59.000Z', ahora)).toBe(false);
    expect(accesoVigente('2026-11-27T12:00:01.000Z', ahora)).toBe(true);
    expect(accesoVigente('no es fecha', ahora)).toBe(false);
  });
});

describe('mensajeCanje', () => {
  it('traduce el error del servidor', () => {
    expect(mensajeCanje(new Error('Invitación no válida o vencida'))).toMatch(/ya fue usado o venció/);
    expect(mensajeCanje(new Error('Este usuario ya es dueño de la granja'))).toMatch(/dueño/);
    expect(mensajeCanje(new Error('algo raro'))).toMatch(/Pide uno nuevo/);
  });
});
