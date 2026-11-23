import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  value: number | string;
  variant?: 'default' | 'primary' | 'warning' | 'success';
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/10 border-primary/20',
  warning: 'bg-warning/10 border-warning/20',
  success: 'bg-secondary border-secondary',
};

const iconStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  warning: 'text-warning-foreground',
  success: 'text-primary',
};

export function StatCard({ icon: Icon, label, hint, value, variant = 'default', onClick }: StatCardProps) {
  const Component = onClick ? 'button' : 'div';
  
  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 sm:gap-4 sm:p-4 rounded-lg border transition-all",
        variantStyles[variant],
        onClick && "hover:scale-[1.02] active:scale-[0.98] cursor-pointer w-full text-left"
      )}
    >
      <div className={cn(
        "flex flex-shrink-0 items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-background/50",
        iconStyles[variant]
      )}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-xs leading-tight text-muted-foreground">{hint}</p>}
      </div>
    </Component>
  );
}
