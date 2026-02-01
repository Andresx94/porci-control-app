import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { MadreCard } from '@/components/MadreCard';
import { EmptyState } from '@/components/EmptyState';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search } from 'lucide-react';
import { EstadoMadre } from '@/types';

const MadresPage = () => {
  const navigate = useNavigate();
  const { madres, obtenerCiclosMadre } = useGranja();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | EstadoMadre>('todas');

  const madresFiltradas = madres.filter(madre => {
    const matchBusqueda = madre.arete.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === 'todas' || madre.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const madresActivas = madresFiltradas.filter(m => m.estado !== 'descartada');
  const madresDescartadas = madresFiltradas.filter(m => m.estado === 'descartada');

  const getUltimoCicloInfo = (madreId: string): string => {
    const ciclos = obtenerCiclosMadre(madreId);
    if (ciclos.length === 0) return 'Sin ciclos registrados';
    const ultimo = ciclos[0];
    return `Ciclo #${ultimo.numeroCiclo} - ${ultimo.estadoCiclo}`;
  };

  return (
    <PageLayout title="Madres">
      <div className="p-4 space-y-4">
        {/* Barra de búsqueda y agregar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por arete..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => navigate('/madres/nueva')} size="icon">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {[
            { value: 'todas', label: 'Todas' },
            { value: 'gestacion', label: 'Gestación' },
            { value: 'lactancia', label: 'Lactancia' },
            { value: 'vacia', label: 'Vacías' },
          ].map(({ value, label }) => (
            <Button
              key={value}
              variant={filtroEstado === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroEstado(value as 'todas' | EstadoMadre)}
              className="flex-shrink-0"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Lista de madres */}
        <Tabs defaultValue="activas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activas">
              Activas ({madresActivas.length})
            </TabsTrigger>
            <TabsTrigger value="descartadas">
              Descartadas ({madresDescartadas.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="activas" className="mt-4">
            {madresActivas.length > 0 ? (
              <div className="space-y-2">
                {madresActivas.map(madre => (
                  <MadreCard
                    key={madre.id}
                    madre={madre}
                    ultimoCicloInfo={getUltimoCicloInfo(madre.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="h-8 w-8 text-muted-foreground" />}
                title="Sin madres registradas"
                description="Agrega tu primera madre para comenzar el control reproductivo"
                action={
                  <Button onClick={() => navigate('/madres/nueva')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Madre
                  </Button>
                }
              />
            )}
          </TabsContent>
          
          <TabsContent value="descartadas" className="mt-4">
            {madresDescartadas.length > 0 ? (
              <div className="space-y-2">
                {madresDescartadas.map(madre => (
                  <MadreCard
                    key={madre.id}
                    madre={madre}
                    ultimoCicloInfo={madre.motivoDescarte || 'Descartada'}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay madres descartadas</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default MadresPage;
