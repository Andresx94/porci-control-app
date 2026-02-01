import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Baby, Calendar, Users, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Ciclo } from '@/types';

const estadoLabels: Record<Ciclo['estadoCiclo'], string> = {
  cruce: 'Cruce',
  gestacion: 'Gestación',
  parto: 'Parto',
  lactancia: 'Lactancia',
  finalizado: 'Finalizado',
  fallido: 'Fallido',
};

const DetalleCicloPage = () => {
  const { id: madreId, cicloId } = useParams<{ id: string; cicloId: string }>();
  const navigate = useNavigate();
  const { obtenerMadre, ciclos, registrarParto, registrarDestete } = useGranja();
  
  const madre = obtenerMadre(madreId!);
  const ciclo = ciclos.find(c => c.id === cicloId);
  
  // Estados para formularios
  const [showPartoForm, setShowPartoForm] = useState(false);
  const [showDesteteForm, setShowDesteteForm] = useState(false);
  
  const [partoData, setPartoData] = useState({
    fechaPartoReal: new Date().toISOString().split('T')[0],
    nacidosTotales: 0,
    nacidosVivos: 0,
    nacidosMuertos: 0,
    observaciones: '',
  });
  
  const [desteteData, setDesteteData] = useState({
    fechaDestete: new Date().toISOString().split('T')[0],
    destetados: 0,
    muertesLactancia: 0,
    observaciones: '',
  });

  if (!madre || !ciclo) {
    return (
      <PageLayout>
        <div className="p-4 text-center">
          <p>Ciclo no encontrado</p>
          <Button onClick={() => navigate('/madres')}>Volver</Button>
        </div>
      </PageLayout>
    );
  }

  const handleRegistrarParto = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (partoData.nacidosTotales <= 0) {
      toast.error('Indica el total de nacidos');
      return;
    }
    
    if (partoData.nacidosVivos + partoData.nacidosMuertos !== partoData.nacidosTotales) {
      toast.error('La suma de vivos y muertos debe ser igual al total');
      return;
    }

    registrarParto(ciclo.id, {
      fechaPartoReal: partoData.fechaPartoReal,
      nacidosTotales: partoData.nacidosTotales,
      nacidosVivos: partoData.nacidosVivos,
      nacidosMuertos: partoData.nacidosMuertos,
      observaciones: partoData.observaciones.trim() || undefined,
    });
    
    toast.success('Parto registrado correctamente');
    setShowPartoForm(false);
  };

  const handleRegistrarDestete = (e: React.FormEvent) => {
    e.preventDefault();
    
    registrarDestete(ciclo.id, {
      fechaDestete: desteteData.fechaDestete,
      destetados: desteteData.destetados,
      muertesLactancia: desteteData.muertesLactancia,
      observaciones: desteteData.observaciones.trim() || undefined,
    });
    
    toast.success('Destete registrado. Ciclo finalizado.');
    navigate(`/madres/${madreId}`);
  };

  const updateNacidos = (field: 'nacidosVivos' | 'nacidosMuertos', value: number) => {
    setPartoData(prev => {
      const updated = { ...prev, [field]: value };
      updated.nacidosTotales = updated.nacidosVivos + updated.nacidosMuertos;
      return updated;
    });
  };

  return (
    <PageLayout>
      <div className="p-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/madres/${madreId}`)}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a {madre.arete}
        </Button>

        {/* Info del ciclo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ciclo #{ciclo.numeroCiclo}</CardTitle>
              <Badge>{estadoLabels[ciclo.estadoCiclo]}</Badge>
            </div>
            <CardDescription>{madre.arete}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Datos de cruce */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="h-4 w-4" />
                Cruce
              </div>
              <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                <span>Fecha: {new Date(ciclo.fechaCruce).toLocaleDateString('es-ES')}</span>
                <span>Tipo: {ciclo.tipoCruce === 'monta_natural' ? 'Monta' : 'IA'}</span>
                <span>Intento: {ciclo.intento}°</span>
                {ciclo.fechaPartoPrevista && (
                  <span>Parto previsto: {new Date(ciclo.fechaPartoPrevista).toLocaleDateString('es-ES')}</span>
                )}
              </div>
            </div>

            {/* Datos de parto si existen */}
            {ciclo.fechaPartoReal && (
              <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Baby className="h-4 w-4" />
                  Parto
                </div>
                <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                  <span>Fecha: {new Date(ciclo.fechaPartoReal).toLocaleDateString('es-ES')}</span>
                  <span>Total: {ciclo.nacidosTotales}</span>
                  <span>Vivos: {ciclo.nacidosVivos}</span>
                  <span>Muertos: {ciclo.nacidosMuertos}</span>
                </div>
              </div>
            )}

            {/* Datos de destete si existen */}
            {ciclo.fechaDestete && (
              <div className="p-3 bg-primary/10 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4" />
                  Destete
                </div>
                <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                  <span>Fecha: {new Date(ciclo.fechaDestete).toLocaleDateString('es-ES')}</span>
                  <span>Destetados: {ciclo.destetados}</span>
                  <span>Muertes lactancia: {ciclo.muertesLactancia}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones según estado */}
        {ciclo.estadoCiclo === 'gestacion' && !showPartoForm && (
          <Button
            size="lg"
            className="w-full h-14"
            onClick={() => setShowPartoForm(true)}
          >
            <Baby className="h-5 w-5 mr-2" />
            Registrar Parto
          </Button>
        )}

        {ciclo.estadoCiclo === 'lactancia' && !showDesteteForm && (
          <Button
            size="lg"
            className="w-full h-14"
            onClick={() => setShowDesteteForm(true)}
          >
            <Users className="h-5 w-5 mr-2" />
            Registrar Destete
          </Button>
        )}

        {/* Formulario de parto */}
        {showPartoForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registrar Parto</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegistrarParto} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaParto">Fecha de Parto</Label>
                  <Input
                    id="fechaParto"
                    type="date"
                    value={partoData.fechaPartoReal}
                    onChange={(e) => setPartoData(prev => ({ ...prev, fechaPartoReal: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nacidosVivos">Nacidos Vivos</Label>
                    <Input
                      id="nacidosVivos"
                      type="number"
                      min="0"
                      value={partoData.nacidosVivos}
                      onChange={(e) => updateNacidos('nacidosVivos', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nacidosMuertos">Nacidos Muertos</Label>
                    <Input
                      id="nacidosMuertos"
                      type="number"
                      min="0"
                      value={partoData.nacidosMuertos}
                      onChange={(e) => updateNacidos('nacidosMuertos', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg text-center">
                  <span className="text-sm text-muted-foreground">Total nacidos: </span>
                  <span className="font-bold text-lg">{partoData.nacidosTotales}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obsParto">Observaciones</Label>
                  <Textarea
                    id="obsParto"
                    placeholder="Notas del parto..."
                    value={partoData.observaciones}
                    onChange={(e) => setPartoData(prev => ({ ...prev, observaciones: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPartoForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Check className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Formulario de destete */}
        {showDesteteForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registrar Destete</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegistrarDestete} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaDestete">Fecha de Destete</Label>
                  <Input
                    id="fechaDestete"
                    type="date"
                    value={desteteData.fechaDestete}
                    onChange={(e) => setDesteteData(prev => ({ ...prev, fechaDestete: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="destetados">Crías Destetadas</Label>
                    <Input
                      id="destetados"
                      type="number"
                      min="0"
                      max={ciclo.nacidosVivos || 99}
                      value={desteteData.destetados}
                      onChange={(e) => setDesteteData(prev => ({ ...prev, destetados: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="muertesLactancia">Muertes en Lactancia</Label>
                    <Input
                      id="muertesLactancia"
                      type="number"
                      min="0"
                      value={desteteData.muertesLactancia}
                      onChange={(e) => setDesteteData(prev => ({ ...prev, muertesLactancia: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obsDestete">Observaciones</Label>
                  <Textarea
                    id="obsDestete"
                    placeholder="Notas del destete..."
                    value={desteteData.observaciones}
                    onChange={(e) => setDesteteData(prev => ({ ...prev, observaciones: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowDesteteForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Check className="h-4 w-4 mr-2" />
                    Finalizar Ciclo
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

export default DetalleCicloPage;
