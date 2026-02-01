import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { AlertaCard } from '@/components/AlertaCard';
import { EmptyState } from '@/components/EmptyState';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Bell, Check } from 'lucide-react';

const AlertasPage = () => {
  const navigate = useNavigate();
  const { alertas, madres, marcarAlertaLeida } = useGranja();

  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const alertasLeidas = alertas.filter(a => a.leida);

  const handleAlertaClick = (alerta: typeof alertas[0]) => {
    if (!alerta.leida) {
      marcarAlertaLeida(alerta.id);
    }
    navigate(`/madres/${alerta.madreId}`);
  };

  const marcarTodasLeidas = () => {
    alertasNoLeidas.forEach(a => marcarAlertaLeida(a.id));
  };

  return (
    <PageLayout title="Alertas">
      <div className="p-4 space-y-6">
        {alertas.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-muted-foreground" />}
            title="Sin alertas"
            description="No hay alertas pendientes. Las alertas se generan automáticamente según los ciclos de las madres."
          />
        ) : (
          <>
            {/* Alertas no leídas */}
            {alertasNoLeidas.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    Pendientes ({alertasNoLeidas.length})
                  </h2>
                  <Button variant="ghost" size="sm" onClick={marcarTodasLeidas}>
                    <Check className="h-4 w-4 mr-1" />
                    Marcar leídas
                  </Button>
                </div>
                <div className="space-y-2">
                  {alertasNoLeidas.map(alerta => {
                    const madre = madres.find(m => m.id === alerta.madreId);
                    return (
                      <AlertaCard
                        key={alerta.id}
                        alerta={alerta}
                        arete={madre?.arete}
                        onClick={() => handleAlertaClick(alerta)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Alertas leídas */}
            {alertasLeidas.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  Leídas ({alertasLeidas.length})
                </h2>
                <div className="space-y-2">
                  {alertasLeidas.map(alerta => {
                    const madre = madres.find(m => m.id === alerta.madreId);
                    return (
                      <AlertaCard
                        key={alerta.id}
                        alerta={alerta}
                        arete={madre?.arete}
                        onClick={() => handleAlertaClick(alerta)}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default AlertasPage;
