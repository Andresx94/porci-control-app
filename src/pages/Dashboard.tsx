import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { StatCard } from '@/components/StatCard';
import { AlertaCard } from '@/components/AlertaCard';
import { useGranja } from '@/contexts/GranjaContext';
import { Users, Baby, Heart, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const navigate = useNavigate();
  const { estadisticas, alertas, madres, isLoading } = useGranja();

  const alertasRecientes = alertas
    .filter(a => !a.leida)
    .slice(0, 3);

  if (isLoading) {
    return (
      <PageLayout title="PorciControl">
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="PorciControl">
      <div className="p-4 space-y-6">
        {/* Estadística principal */}
        <StatCard
          icon={Users}
          label="Total Madres Activas"
          value={estadisticas.totalMadresActivas}
          variant="primary"
          onClick={() => navigate('/madres')}
        />

        {/* Grid de estadísticas */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Baby}
            label="En Gestación"
            value={estadisticas.enGestacion}
            variant="success"
          />
          <StatCard
            icon={Clock}
            label="Próximas a Parir"
            value={estadisticas.proximasParir}
            variant={estadisticas.proximasParir > 0 ? 'warning' : 'default'}
          />
          <StatCard
            icon={Heart}
            label="Listas para Cruce"
            value={estadisticas.listasParaCruce}
            variant="default"
          />
          <StatCard
            icon={Users}
            label="En Lactancia"
            value={estadisticas.enLactancia}
            variant="success"
          />
        </div>

        {/* Alertas recientes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas
            </h2>
            {alertas.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/alertas')}>
                Ver todas
              </Button>
            )}
          </div>
          
          {alertasRecientes.length > 0 ? (
            <div className="space-y-2">
              {alertasRecientes.map(alerta => {
                const madre = madres.find(m => m.id === alerta.madreId);
                return (
                  <AlertaCard
                    key={alerta.id}
                    alerta={alerta}
                    arete={madre?.arete}
                    onClick={() => navigate(`/madres/${alerta.madreId}`)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay alertas pendientes</p>
            </div>
          )}
        </section>

        {/* Acceso rápido */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-14"
              onClick={() => navigate('/madres/nueva')}
            >
              + Nueva Madre
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14"
              onClick={() => navigate('/reportes')}
            >
              Ver Reportes
            </Button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default Dashboard;
