import { useEffect, useState } from 'react';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { mensajeCanje, tokenDeUrl } from '@/lib/invitaciones';
import { canjearInvitacion } from '@/lib/trabajadores';
import { elegirGranjaGuardada, cerrarSesion } from '@/lib/remotoSupabase';

type Estado = 'espera' | 'canjeando' | 'listo' | 'error' | 'dueno';

// Un canje por token aunque React monte el componente dos veces (StrictMode).
const canjes = new Map<string, Promise<string>>();

const irAInicio = () => window.location.replace(import.meta.env.BASE_URL);

// Pantalla del trabajador al abrir su enlace de invitación (?invitacion=...).
const InvitacionPage = () => {
  const { sesionComprobada, haySesion, sesionAnonima } = useGranja();
  const [estado, setEstado] = useState<Estado>('espera');
  const [mensaje, setMensaje] = useState('');
  const token = tokenDeUrl(window.location.search);

  useEffect(() => {
    if (!sesionComprobada) return;
    if (!token) {
      setMensaje('El enlace no es válido. Pide uno nuevo al dueño');
      setEstado('error');
      return;
    }
    // Sesión de dueño (con correo) en este dispositivo: no se canjea.
    if (haySesion && !sesionAnonima) {
      setEstado('dueno');
      return;
    }
    let vivo = true;
    setEstado('canjeando');
    let promesa = canjes.get(token);
    if (!promesa) {
      promesa = canjearInvitacion(token);
      canjes.set(token, promesa);
    }
    promesa
      .then(granjaId => {
        elegirGranjaGuardada(granjaId);
        // Quita el token de la URL y arranca la app limpia con la granja nueva.
        window.history.replaceState({}, '', import.meta.env.BASE_URL);
        if (vivo) setEstado('listo');
        irAInicio();
      })
      .catch(error => {
        canjes.delete(token);
        if (!vivo) return;
        setMensaje(mensajeCanje(error));
        setEstado('error');
      });
    return () => {
      vivo = false;
    };
  }, [sesionComprobada, haySesion, sesionAnonima, token]);

  // Tras un error se descarta la sesión anónima que quedó sin granja.
  const salirDelError = async () => {
    if (sesionAnonima) {
      try {
        await cerrarSesion();
      } catch {
        // sin red: igual se vuelve al inicio
      }
    }
    irAInicio();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 safe-top">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold text-primary">PorciControl</h1>
        {(estado === 'espera' || estado === 'canjeando' || estado === 'listo') && (
          <p className="text-sm text-muted-foreground" role="status">Abriendo tu acceso…</p>
        )}
        {estado === 'dueno' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">Este navegador tiene tu sesión de dueño, así que el enlace no se usó.</p>
            <p className="text-sm text-muted-foreground">
              Ábrelo en el celular del trabajador (o en otro navegador sin tu sesión). Si entras aquí, seguirás como dueño con todos los permisos.
            </p>
            <Button className="w-full h-12" onClick={irAInicio}>Seguir como dueño</Button>
          </div>
        )}
        {estado === 'error' && (
          <div className="space-y-4">
            <p className="text-sm text-destructive" role="alert">{mensaje}</p>
            <Button variant="outline" className="w-full h-12" onClick={salirDelError}>Entendido</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitacionPage;
