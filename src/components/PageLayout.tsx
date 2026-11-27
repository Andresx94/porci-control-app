import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { DemoBanner } from './DemoBanner';
import { AvisoInstalar } from './AvisoInstalar';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-24">
      <div className="sticky top-0 z-40 print:hidden">
        <DemoBanner />
        {title && (
          <header className="bg-primary text-primary-foreground safe-top">
            <div className="flex items-center justify-center h-14 px-4 max-w-5xl mx-auto">
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </header>
        )}
      </div>
      <AvisoInstalar className="mx-4 mt-3" />
      <main className="animate-fade-in max-w-5xl mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
