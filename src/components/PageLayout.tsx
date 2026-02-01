import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background pb-20">
      {title && (
        <header className="sticky top-0 z-40 bg-primary text-primary-foreground safe-top">
          <div className="flex items-center justify-center h-14 px-4">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
        </header>
      )}
      <main className="animate-fade-in">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
