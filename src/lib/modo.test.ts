import { afterEach, describe, expect, it, vi } from 'vitest';
import { esDemo } from '@/lib/datos';

const url = (q: string) => window.history.replaceState({}, '', `/${q}`);

describe('esDemo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    url('');
  });

  const conNube = () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'clave-publica-de-prueba');
  };
  const sinNube = () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  };

  it('sin parametro y con nube es real', () => {
    conNube();
    url('');
    expect(esDemo()).toBe(false);
  });

  it('sin parametro y sin nube es demo', () => {
    sinNube();
    url('');
    expect(esDemo()).toBe(true);
  });

  it('?demo=1 es demo aunque haya nube', () => {
    conNube();
    url('?demo=1');
    expect(esDemo()).toBe(true);
  });

  it('?real=1 es real aunque no haya nube', () => {
    sinNube();
    url('?real=1');
    expect(esDemo()).toBe(false);
  });
});
