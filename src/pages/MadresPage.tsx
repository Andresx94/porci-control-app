import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { MadreCard } from '@/components/MadreCard';
import { EmptyState } from '@/components/EmptyState';
import { useGranja } from '@/contexts/GranjaContext';
import { puede } from '@/lib/permisos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, ArrowDown01, ArrowUp10 } from 'lucide-react';
import { compararAretes, esProximaAParir } from '@/lib/fechas';
import { guardarPreferencia, leerPreferencia } from '@/lib/datos';

const FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'gestacion', label: 'Gestación' },
  { value: 'proximas', label: 'Próximas a parir' },
  { value: 'lactancia', label: 'Maternidad' },
  { value: 'vacia', label: 'Vacías' },
];

const ORDEN_KEY = 'granja_orden_madres';

const leerOrden = (): 'asc' | 'desc' => (leerPreferencia(ORDEN_KEY) === 'desc' ? 'desc' : 'asc');

const MadresPage = () => {
  const navigate = useNavigate();
  const { madres, ciclos, obtenerCiclosMadre, rolNube } = useGranja();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'asc' | 'desc'>(leerOrden);

  const estadoUrl = searchParams.get('estado');
  const filtroEstado = FILTROS.some(f => f.value === estadoUrl) ? estadoUrl! : 'todas';

  const cambiarFiltro = (value: string) => {
    setSearchParams(value === 'todas' ? {} : { estado: value }, { replace: true });
  };

  const cambiarOrden = () => {
    const nuevo = orden === 'asc' ? 'desc' : 'asc';
    setOrden(nuevo);
    guardarPreferencia(ORDEN_KEY, nuevo);
  };

  const madresFiltradas = madres
    .filter(madre => {
      const matchBusqueda = madre.arete.toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === 'todas'
        || (filtroEstado === 'proximas'
          ? ciclos.some(c => c.madreId === madre.id && esProximaAParir(c))
          : madre.estado === filtroEstado);
      return matchBusqueda && matchEstado;
    })
    .sort((a, b) => (orden === 'asc' ? 1 : -1) * compararAretes(a.arete, b.arete));

  const hayFiltros = filtroEstado !== 'todas' || busqueda.trim() !== '';

  const madresActivas = madresFiltradas.filter(m => m.estado !== 'descartada');
  const madresDescartadas = madresFiltradas.filter(m => m.estado === 'descartada');

  const getUltimoCicloInfo = (madreId: string): string => {
    const ciclos = obtenerCiclosMadre(madreId);
    if (ciclos.length === 0) return 'Sin ciclos registrados';
    const ultimo = ciclos[0];
    const intento = ultimo.intento > 1 ? ` (${ultimo.intento}° intento)` : '';
    const estado = ultimo.estadoCiclo === 'fallido' ? 'no preñó' : ultimo.estadoCiclo;
    return `Ciclo #${ultimo.numeroCiclo}${intento} - ${estado}`;
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
          {puede(rolNube, 'crearMadre') && <Button onClick={() => navigate('/madres/nueva')} size="icon" aria-label="Nueva madre">
            <Plus className="h-5 w-5" />
          </Button>}
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {FILTROS.map(({ value, label }) => (
            <Button
              key={value}
              variant={filtroEstado === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => cambiarFiltro(value)}
              className="flex-shrink-0"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Orden */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={cambiarOrden}>
            {orden === 'asc' ? <ArrowDown01 className="h-4 w-4 mr-2" /> : <ArrowUp10 className="h-4 w-4 mr-2" />}
            {orden === 'asc' ? 'Arete: menor a mayor' : 'Arete: mayor a menor'}
          </Button>
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
              <div className="grid gap-2 lg:grid-cols-2">
                {madresActivas.map(madre => (
                  <MadreCard
                    key={madre.id}
                    madre={madre}
                    ultimoCicloInfo={getUltimoCicloInfo(madre.id)}
                  />
                ))}
              </div>
            ) : hayFiltros ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Ninguna madre coincide con este filtro</p>
              </div>
            ) : (
              <EmptyState
                icon={<Users className="h-8 w-8 text-muted-foreground" />}
                title="Sin madres registradas"
                description="Agrega tu primera madre para comenzar el control reproductivo"
                action={
                  puede(rolNube, 'crearMadre') && (
                    <Button onClick={() => navigate('/madres/nueva')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Madre
                    </Button>
                  )
                }
              />
            )}
          </TabsContent>
          
          <TabsContent value="descartadas" className="mt-4">
            {madresDescartadas.length > 0 ? (
              <div className="grid gap-2 lg:grid-cols-2">
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
