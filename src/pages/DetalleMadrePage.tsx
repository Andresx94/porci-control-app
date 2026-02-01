import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { CicloCard } from '@/components/CicloCard';
import { EmptyState } from '@/components/EmptyState';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Madre } from '@/types';

const estadoLabels: Record<Madre['estado'], string> = {
  activa: 'Activa',
  gestacion: 'En Gestación',
  lactancia: 'En Lactancia',
  vacia: 'Vacía',
  descartada: 'Descartada',
};

const DetalleMadrePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { obtenerMadre, obtenerCiclosMadre, obtenerCicloActual, descartarMadre } = useGranja();
  
  const [showDescarteDialog, setShowDescarteDialog] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');

  const madre = obtenerMadre(id!);
  const ciclos = obtenerCiclosMadre(id!);
  const cicloActual = obtenerCicloActual(id!);

  if (!madre) {
    return (
      <PageLayout>
        <div className="p-4">
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Madre no encontrada"
            description="La madre que buscas no existe"
            action={
              <Button onClick={() => navigate('/madres')}>
                Volver a Madres
              </Button>
            }
          />
        </div>
      </PageLayout>
    );
  }

  const handleDescartar = () => {
    if (!motivoDescarte.trim()) {
      toast.error('Indica el motivo del descarte');
      return;
    }
    descartarMadre(madre.id, motivoDescarte.trim());
    toast.success('Madre marcada como descartada');
    setShowDescarteDialog(false);
    navigate('/madres');
  };

  const puedeIniciarCiclo = madre.estado === 'vacia' || madre.estado === 'activa';

  return (
    <PageLayout>
      <div className="p-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/madres')}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Información básica */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{madre.arete}</CardTitle>
              <Badge variant={madre.estado === 'descartada' ? 'destructive' : 'default'}>
                {estadoLabels[madre.estado]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {madre.fechaNacimiento && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Nacimiento: {new Date(madre.fechaNacimiento).toLocaleDateString('es-ES')}</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <span>Registro: {new Date(madre.fechaRegistro).toLocaleDateString('es-ES')}</span>
            </div>
            {madre.observaciones && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                {madre.observaciones}
              </p>
            )}
            <div className="text-sm font-medium">
              Total ciclos: {ciclos.length}
            </div>
          </CardContent>
        </Card>

        {/* Acciones principales */}
        {madre.estado !== 'descartada' && (
          <div className="grid grid-cols-2 gap-3">
            {puedeIniciarCiclo && (
              <Button
                size="lg"
                className="h-14"
                onClick={() => navigate(`/madres/${madre.id}/nuevo-ciclo`)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Ciclo
              </Button>
            )}
            {cicloActual && (
              <Button
                size="lg"
                variant="secondary"
                className="h-14"
                onClick={() => navigate(`/madres/${madre.id}/ciclo/${cicloActual.id}`)}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Continuar Ciclo
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="h-14 text-destructive border-destructive/50"
              onClick={() => setShowDescarteDialog(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Descartar
            </Button>
          </div>
        )}

        {/* Historial de ciclos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Historial de Ciclos
          </h2>
          {ciclos.length > 0 ? (
            <div className="space-y-2">
              {ciclos.map(ciclo => (
                <CicloCard
                  key={ciclo.id}
                  ciclo={ciclo}
                  onClick={() => navigate(`/madres/${madre.id}/ciclo/${ciclo.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<RefreshCw className="h-8 w-8 text-muted-foreground" />}
              title="Sin ciclos"
              description="Esta madre aún no tiene ciclos reproductivos registrados"
              action={
                puedeIniciarCiclo && (
                  <Button onClick={() => navigate(`/madres/${madre.id}/nuevo-ciclo`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Iniciar Primer Ciclo
                  </Button>
                )
              }
            />
          )}
        </section>
      </div>

      {/* Dialog de descarte */}
      <Dialog open={showDescarteDialog} onOpenChange={setShowDescarteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar Madre</DialogTitle>
            <DialogDescription>
              Esta acción marcará a {madre.arete} como descartada. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo del descarte</Label>
            <Input
              id="motivo"
              placeholder="Ej: Edad avanzada, problemas reproductivos..."
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDescarteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDescartar}>
              Confirmar Descarte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default DetalleMadrePage;
