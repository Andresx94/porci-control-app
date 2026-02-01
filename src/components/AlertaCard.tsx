import { cn } from '@/lib/utils';
import { Alerta } from '@/types';
import { AlertTriangle, Baby, Heart, Calendar } from 'lucide-react';

interface AlertaCardProps {
  alerta: Alerta;
  arete?: string;
  onClick?: () => void;
}

const iconMap = {
  parto_proximo: Baby,
  destete_pendiente: Calendar,
  lista_cruce: Heart,
  revision: AlertTriangle,
};

const prioridadStyles = {
  alta: 'border-l-destructive bg-destructive/5',
  media: 'border-l-warning bg-warning/5',
  baja: 'border-l-primary bg-primary/5',
};

export function AlertaCard({ alerta, arete, onClick }: AlertaCardProps) {
  const Icon = iconMap[alerta.tipo];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 bg-card rounded-lg border border-border border-l-4",
        "hover:shadow-sm active:scale-[0.99] transition-all text-left",
        prioridadStyles[alerta.prioridad],
        alerta.leida && "opacity-60"
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full",
        alerta.prioridad === 'alta' && "bg-destructive/10 text-destructive",
        alerta.prioridad === 'media' && "bg-warning/10 text-warning-foreground",
        alerta.prioridad === 'baja' && "bg-primary/10 text-primary"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{alerta.mensaje}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {arete && <span>{arete}</span>}
          <span>•</span>
          <span>{new Date(alerta.fechaAlerta).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
    </button>
  );
}
