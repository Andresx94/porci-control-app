import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Bell, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGranja } from '@/contexts/GranjaContext';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/madres', icon: Users, label: 'Madres' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
  { to: '/ajustes', icon: Settings, label: 'Ajustes' },
];

export function BottomNav() {
  const location = useLocation();
  const { alertas } = useGranja();
  
  const alertasNoLeidas = alertas.filter(a => !a.leida).length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          const isAlertTab = to === '/alertas';
          
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-6 w-6" />
                {isAlertTab && alertasNoLeidas > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {alertasNoLeidas > 9 ? '9+' : alertasNoLeidas}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive && "font-semibold"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
