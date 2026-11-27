import { useCallback, useEffect, useState } from 'react';
import { Copy, Share2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { formatFecha } from '@/lib/fechas';
import { accesoVigente, DIAS_ACCESO, DiasAcceso } from '@/lib/invitaciones';
import {
  anularInvitacion,
  crearInvitacion,
  InvitacionPendiente,
  listarInvitaciones,
  listarTrabajadores,
  quitarTrabajador,
  renovarTrabajador,
  Trabajador,
} from '@/lib/trabajadores';

const textoDias = (d: number) => `${d} días`;

// Solo para el dueño: invitar trabajadores por enlace, renovar o quitar su acceso.
export function TrabajadoresCard({ granjaId }: { granjaId: string }) {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendiente[]>([]);
  const [nombre, setNombre] = useState('');
  const [dias, setDias] = useState<DiasAcceso>(30);
  const [creando, setCreando] = useState(false);
  // El enlace solo vive en memoria mientras esta pantalla esté abierta.
  const [enlace, setEnlace] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<Trabajador | null>(null);
  const [aRenovar, setARenovar] = useState<Trabajador | null>(null);
  const [diasRenovar, setDiasRenovar] = useState<DiasAcceso>(30);

  const cargar = useCallback(async () => {
    try {
      const [t, i] = await Promise.all([listarTrabajadores(granjaId), listarInvitaciones(granjaId)]);
      setTrabajadores(t);
      setInvitaciones(i);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar');
    }
  }, [granjaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    try {
      setEnlace(await crearInvitacion(granjaId, nombre, dias));
      setNombre('');
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el enlace');
    } finally {
      setCreando(false);
    }
  };

  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar; mantén pulsado el enlace para copiarlo');
    }
  };

  const compartir = async () => {
    if (!enlace) return;
    try {
      await navigator.share({ title: 'PorciControl', text: 'Tu acceso a PorciControl', url: enlace });
    } catch {
      // el usuario canceló
    }
  };

  const ejecutar = async (accion: () => Promise<void>, ok: string) => {
    try {
      await accion();
      toast.success(ok);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar');
    }
  };

  const textoVence = (t: Trabajador) =>
    accesoVigente(t.venceEn) ? (t.venceEn ? `vence el ${formatFecha(t.venceEn)}` : 'no vence') : 'vencido';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Trabajadores
        </CardTitle>
        <CardDescription>
          Pueden crear cruces y registrar parto, destete y fallo. No pueden editar ni borrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={crear} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="trab-nombre">Nombre del trabajador</Label>
            <Input id="trab-nombre" className="h-12" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Juan" />
          </div>
          <div className="space-y-1">
            <Label>Duración del acceso</Label>
            <Select value={String(dias)} onValueChange={v => setDias(Number(v) as DiasAcceso)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAS_ACCESO.map(d => <SelectItem key={d} value={String(d)}>{textoDias(d)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full h-12" disabled={creando}>
            {creando ? 'Creando…' : 'Crear enlace'}
          </Button>
        </form>

        {enlace && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Úsalo en el celular del trabajador; sirve una sola vez y vence en 7 días.
            </p>
            <p className="break-all text-sm select-all">{enlace}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={copiar}>
                <Copy className="h-4 w-4 mr-2" />Copiar
              </Button>
              {typeof navigator.share === 'function' && (
                <Button type="button" variant="outline" className="flex-1 h-11" onClick={compartir}>
                  <Share2 className="h-4 w-4 mr-2" />Compartir
                </Button>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setEnlace(null)}>
              Ocultar enlace
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Trabajadores</h3>
          {trabajadores.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay trabajadores.</p>}
          {trabajadores.map(t => (
            <div key={t.usuarioId} className="rounded-md border p-3 space-y-2">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-medium truncate">{t.nombre || 'Sin nombre'}</span>
                <span className={accesoVigente(t.venceEn) ? 'text-muted-foreground' : 'text-destructive'}>{textoVence(t)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => { setDiasRenovar(30); setARenovar(t); }}>
                  Renovar
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-10 text-destructive" onClick={() => setAQuitar(t)}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>

        {invitaciones.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Invitaciones pendientes</h3>
            {invitaciones.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{i.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">
                    Enlace vence el {formatFecha(i.venceEn)} · {textoDias(i.dias)} de acceso
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-10" onClick={() => ejecutar(() => anularInvitacion(i.id), 'Invitación anulada')}>
                  Anular
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!aQuitar} onOpenChange={o => !o && setAQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {aQuitar?.nombre || 'este trabajador'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderá el acceso de inmediato. Sus registros se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aQuitar && ejecutar(() => quitarTrabajador(granjaId, aQuitar.usuarioId), 'Trabajador quitado')}
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!aRenovar} onOpenChange={o => !o && setARenovar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar a {aRenovar?.nombre || 'este trabajador'}</AlertDialogTitle>
            <AlertDialogDescription>El acceso vencerá dentro de:</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={String(diasRenovar)} onValueChange={v => setDiasRenovar(Number(v) as DiasAcceso)}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIAS_ACCESO.map(d => <SelectItem key={d} value={String(d)}>{textoDias(d)} desde hoy</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aRenovar && ejecutar(() => renovarTrabajador(granjaId, aRenovar.usuarioId, diasRenovar), 'Acceso renovado')}
            >
              Renovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
