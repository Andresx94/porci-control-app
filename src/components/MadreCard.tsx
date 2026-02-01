import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Madre } from '@/types';
import { Badge } from '@/components/ui/badge';

interface MadreCardProps {
  madre: Madre;
  ultimoCicloInfo?: string;
}

const estadoLabels: Record<Madre['estado'], string> = {
  activa: 'Activa',
  gestacion: 'En Gestación',
  lactancia: 'En Lactancia',
  vacia: 'Vacía',
  descartada: 'Descartada',
};

const estadoVariants: Record<Madre['estado'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  activa: 'secondary',
  gestacion: 'default',
  lactancia: 'secondary',
  vacia: 'outline',
  descartada: 'destructive',
};

export function MadreCard({ madre, ultimoCicloInfo }: MadreCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/madres/${madre.id}`)}
      className={cn(
        "w-full flex items-center gap-4 p-4 bg-card rounded-lg border border-border",
        "hover:border-primary/30 active:scale-[0.99] transition-all text-left"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-foreground">{madre.arete}</span>
          <Badge variant={estadoVariants[madre.estado]} className="text-xs">
            {estadoLabels[madre.estado]}
          </Badge>
        </div>
        {ultimoCicloInfo && (
          <p className="text-sm text-muted-foreground truncate">{ultimoCicloInfo}</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
