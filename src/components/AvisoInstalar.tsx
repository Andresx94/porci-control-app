import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { guardarPreferencia, leerPreferencia } from '@/lib/datos';

const CLAVE_DESCARTE = 'aviso_instalar_descartado';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

function esIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

function esSafari(): boolean {
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

export function AvisoInstalar({ className = '' }: { className?: string }) {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [descartado, setDescartado] = useState(() => leerPreferencia(CLAVE_DESCARTE) === '1');
  const [instalada, setInstalada] = useState(estaInstalada);

  useEffect(() => {
    const alPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => {
      setEvento(null);
      setInstalada(true);
    };
    window.addEventListener('beforeinstallprompt', alPrompt);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPrompt);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (instalada || descartado) return null;

  const mostrarIos = !evento && esIos() && esSafari();
  if (!evento && !mostrarIos) return null;

  const descartar = () => {
    guardarPreferencia(CLAVE_DESCARTE, '1');
    setDescartado(true);
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === 'dismissed') descartar();
  };

  return (
    <div
      role="note"
      className={`flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground print:hidden ${className}`}
    >
      <span className="min-w-0 flex-1">
        {evento
          ? 'Instala PorciControl para abrirla como una app, incluso sin señal.'
          : "Para instalar: toca Compartir y luego 'Agregar a pantalla de inicio'."}
      </span>
      {evento && (
        <Button size="sm" className="h-8 flex-shrink-0" onClick={instalar}>
          Instalar app
        </Button>
      )}
      <button type="button" aria-label="Descartar aviso" className="flex-shrink-0 p-1 text-muted-foreground" onClick={descartar}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
