import { cn } from '@/lib/utils';
import { Ciclo } from '@/types';
import { Calendar, Baby, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatFecha } from '@/lib/fechas';

interface CicloCardProps {
  ciclo: Ciclo;
  onClick?: () => void;
}

const estadoLabels: Record<Ciclo['estadoCiclo'], string> = {
  cruce: 'Cruce',
  gestacion: 'Gestación',
  parto: 'Parto',
  lactancia: 'Lactancia',
  finalizado: 'Finalizado',
  fallido: 'Fallido',
};

const estadoVariants: Record<Ciclo['estadoCiclo'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  cruce: 'outline',
  gestacion: 'default',
  parto: 'secondary',
  lactancia: 'secondary',
  finalizado: 'outline',
  fallido: 'destructive',
};

export function CicloCard({ ciclo, onClick }: CicloCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 bg-card rounded-lg border border-border",
        "hover:border-primary/30 active:scale-[0.99] transition-all text-left"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-foreground">Ciclo #{ciclo.numeroCiclo}</span>
        <Badge variant={estadoVariants[ciclo.estadoCiclo]}>
          {estadoLabels[ciclo.estadoCiclo]}
        </Badge>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Cruce: {formatFecha(ciclo.fechaCruce)}</span>
        </div>
        
        {ciclo.fechaPartoReal && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Baby className="h-4 w-4" />
            <span>
              Parto: {formatFecha(ciclo.fechaPartoReal)}{' '}
              ({ciclo.nacidosVivos} vivos / {ciclo.nacidosTotales} total)
            </span>
          </div>
        )}
        
        {ciclo.fechaDestete && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Destete: {ciclo.destetados} crías</span>
          </div>
        )}
      </div>
    </button>
  );
}
