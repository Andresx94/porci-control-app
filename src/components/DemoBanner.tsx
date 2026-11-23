import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { borrarDatos, esDemo, hayDatosReales } from '@/lib/datos';

export function DemoBanner() {
  const [confirmar, setConfirmar] = useState(false);

  if (!esDemo()) return null;

  const restablecer = () => {
    borrarDatos();
    window.location.reload();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 bg-warning px-3 py-1.5 text-xs text-warning-foreground">
        <span className="min-w-0 font-medium">Demo: datos de ejemplo</span>
        <span className="flex flex-shrink-0 items-center gap-3">
          {hayDatosReales() && (
            <a className="font-semibold underline" href={`${window.location.pathname}?real=1`}>
              Mis datos
            </a>
          )}
          <button type="button" className="text-xs font-semibold underline" onClick={() => setConfirmar(true)}>
            Restablecer
          </button>
        </span>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restablecer la demo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderán los cambios hechos en la demo y volverán los datos de ejemplo con la fecha de hoy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={restablecer}>Sí, restablecer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
