import { useState } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, Upload, Info, Cloud } from 'lucide-react';
import { hayNube } from '@/lib/supabase';
import type { EstadoNube } from '@/contexts/GranjaContext';
import { toast } from 'sonner';
import { armarCopia, borrarDatos, esDemo, importarDatos, nombreArchivoCopia, reintentarConflictos } from '@/lib/datos';
import { puede } from '@/lib/permisos';
import { formatFecha } from '@/lib/fechas';
import { TrabajadoresCard } from '@/components/TrabajadoresCard';

const TEXTO_ESTADO: Record<EstadoNube, string> = {
  apagada: 'Apagada',
  sin_sesion: 'Sin sesión',
  sincronizando: 'Sincronizando…',
  al_dia: 'Al día',
  sin_conexion: 'Sin conexión',
  error: 'Error al sincronizar',
};

const AjustesPage = () => {
  const {
    madres, ciclos, estadoNube, pendientes, conflictos, sincronizarAhora,
    correoNube, granjasNube, granjaNubeId, elegirGranjaNube, salirNube,
    rolNube, venceNube, sesionAnonima, haySesion,
  } = useGranja();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const demo = esDemo();
  const mostrarNube = !demo && hayNube();
  const esTrabajador = rolNube === 'operario';
  const granjaActual = granjasNube.find(g => g.id === granjaNubeId);

  const handleExportData = () => {
    const data = armarCopia(madres, ciclos, granjaActual?.nombre);
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivoCopia();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Copia descargada');
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.madres && data.ciclos) {
          importarDatos(data);
          toast.success('Datos importados. Recarga la página para ver los cambios.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error('Archivo inválido');
        }
      } catch (error) {
        toast.error('Error al importar datos');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    borrarDatos();
    toast.success('Datos eliminados');
    setShowResetDialog(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <PageLayout title="Ajustes">
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* Info de la app */}
        {!esTrabajador && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              PorciControl
            </CardTitle>
            <CardDescription>
              Sistema de control reproductivo porcino
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versión</span>
                <span>1.0.0 MVP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Madres registradas</span>
                <span>{madres.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ciclos totales</span>
                <span>{ciclos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Almacenamiento</span>
                <span>{demo ? 'Demo (este navegador)' : 'Local (dispositivo)'}</span>
              </div>
            </div>
          </CardContent>
        </Card>}

        {!demo && !esTrabajador && (
          <Button variant="outline" className="w-full h-12" asChild>
            <a href={import.meta.env.BASE_URL + '?demo=1'}>
              Ver demo con datos de ejemplo
            </a>
          </Button>
        )}

        {/* Nube: solo en modo real y con configuración */}
        {mostrarNube && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Nube
            </CardTitle>
            <CardDescription>
              Respalda y comparte los datos de la granja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!haySesion ? (
              <p className="text-sm text-muted-foreground">Sin sesión.</p>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  {!sesionAnonima && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Correo</span>
                      <span className="truncate">{correoNube}</span>
                    </div>
                  )}
                  {esTrabajador && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Acceso hasta</span>
                      <span>{venceNube ? formatFecha(venceNube) : 'Sin vencimiento'}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado</span>
                    <span>{TEXTO_ESTADO[estadoNube]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pendientes de subir</span>
                    <span>{pendientes}</span>
                  </div>
                </div>

                {granjasNube.length > 1 && !esTrabajador && (
                  <div className="space-y-1">
                    <Label>Granja</Label>
                    <Select value={granjaNubeId ?? undefined} onValueChange={elegirGranjaNube}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Elige una granja" />
                      </SelectTrigger>
                      <SelectContent>
                        {granjasNube.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(granjasNube.length === 1 || (esTrabajador && granjaActual)) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Granja</span>
                    <span className="truncate">{(granjaActual ?? granjasNube[0]).nombre}</span>
                  </div>
                )}
                {!granjaNubeId && (
                  <p className="text-sm text-muted-foreground">Elige una granja para sincronizar.</p>
                )}

                {conflictos.length > 0 && (
                  <div className="rounded-md border border-destructive/50 p-3 space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      {conflictos.length} {conflictos.length === 1 ? 'registro no se pudo subir' : 'registros no se pudieron subir'}
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {conflictos.map(c => (
                        <li key={`${c.tabla}-${c.id}`} className="break-words">
                          {c.tabla === 'madres' ? 'Madre' : 'Ciclo'}: {c.error}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={estadoNube === 'sincronizando'}
                      onClick={() => {
                        reintentarConflictos();
                        sincronizarAhora();
                      }}
                    >
                      Reintentar subir
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => sincronizarAhora()}
                  disabled={estadoNube === 'sincronizando' || !granjaNubeId}
                >
                  Sincronizar ahora
                </Button>
                <Button variant="outline" className="w-full h-12" onClick={() => salirNube()}>
                  {esTrabajador ? 'Salir' : 'Cerrar sesión'}
                </Button>
                {esTrabajador && (
                  <p className="text-xs text-muted-foreground">
                    Si sales, necesitarás un enlace nuevo del dueño para volver a entrar.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>}

        {/* Trabajadores: solo el dueño, con nube */}
        {mostrarNube && !!granjaNubeId && rolNube === 'dueno' && puede(rolNube, 'gestionarTrabajadores') && (
          <TrabajadoresCard granjaId={granjaNubeId} />
        )}

        {/* Backup */}
        {!demo && !esTrabajador && <Card>
          <CardHeader>
            <CardTitle>Respaldo de Datos</CardTitle>
            <CardDescription>
              Descarga una copia completa (madres y ciclos) o restaura una copia anterior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={handleExportData}
            >
              <Download className="h-5 w-5 mr-2" />
              Descargar copia completa
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="w-full h-12"
              >
                <Upload className="h-5 w-5 mr-2" />
                Restaurar desde copia
              </Button>
            </div>
          </CardContent>
        </Card>}

        {/* Zona de peligro */}
        {!demo && !esTrabajador && <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
            <CardDescription>
              Acciones irreversibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full h-12"
              onClick={() => setShowResetDialog(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Eliminar Todos los Datos
            </Button>
          </CardContent>
        </Card>}

        {/* Créditos */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Desarrollado para granjas porcinas</p>
          <p className="text-xs mt-1">
            {demo ? 'Los cambios de la demo quedan en este navegador hasta restablecer' : 'Los datos se guardan localmente en tu dispositivo'}
          </p>
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar todos los datos?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todas las madres, ciclos y alertas. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleResetData}>
              Sí, eliminar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AjustesPage;
