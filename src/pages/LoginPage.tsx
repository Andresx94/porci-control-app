import { useState } from 'react';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LoginPage = () => {
  const { sesionComprobada, correoNube, entrarNube, salirNube } = useGranja();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEntrando(true);
    try {
      await entrarNube(correo, clave);
      setClave('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEntrando(false);
    }
  };

  // Recarga en la demo (la URL base de Vite es /porci-control-app/)
  const verDemo = () => window.location.assign(import.meta.env.BASE_URL + '?demo=1');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 safe-top">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-bold text-primary">PorciControl</h1>

        {!sesionComprobada ? (
          <p className="text-center text-sm text-muted-foreground" role="status">Comprobando sesión…</p>
        ) : correoNube ? (
          <div className="space-y-4 text-center">
            <p className="text-sm">Tu usuario no tiene granja asignada; pide acceso al dueño.</p>
            <Button variant="outline" className="w-full h-12" onClick={() => salirNube()}>
              Cerrar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={entrar} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="login-correo">Correo</Label>
              <Input id="login-correo" type="email" autoComplete="email" className="h-12"
                value={correo} onChange={e => setCorreo(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="login-clave">Contraseña</Label>
              <Input id="login-clave" type="password" autoComplete="current-password" className="h-12"
                value={clave} onChange={e => setClave(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full h-12" disabled={entrando}>
              {entrando ? 'Entrando…' : 'Entrar'}
            </Button>
            <Button type="button" variant="ghost" className="w-full h-12" onClick={verDemo}>
              Ver demo
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
