import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { GranjaProvider, useGranja } from "@/contexts/GranjaContext";
import LoginPage from "./pages/LoginPage";
import InvitacionPage from "./pages/InvitacionPage";
import { puede, Accion } from "@/lib/permisos";
import { tokenDeUrl } from "@/lib/invitaciones";
import { esDemo } from "@/lib/datos";
import { hayNube } from "@/lib/supabase";
import Dashboard from "./pages/Dashboard";
import MadresPage from "./pages/MadresPage";
import NuevaMadrePage from "./pages/NuevaMadrePage";
import DetalleMadrePage from "./pages/DetalleMadrePage";
import NuevoCicloPage from "./pages/NuevoCicloPage";
import DetalleCicloPage from "./pages/DetalleCicloPage";
import AlertasPage from "./pages/AlertasPage";
import ReportesPage from "./pages/ReportesPage";
import FechasPage from "./pages/FechasPage";
import AjustesPage from "./pages/AjustesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Modo real con nube: sin sesion (o sin granja asignada) se muestra el login en lugar de la app.
const Puerta = ({ children }: { children: React.ReactNode }) => {
  const { sesionComprobada, haySesion, granjasCargadas, granjasNube } = useGranja();
  if (esDemo() || !hayNube()) return <>{children}</>;
  if (tokenDeUrl(window.location.search)) return <InvitacionPage />;
  if (!sesionComprobada || !haySesion || (granjasCargadas && granjasNube.length === 0)) return <LoginPage />;
  return <>{children}</>;
};

// Ruta que el trabajador no puede abrir: lo manda al inicio.
const Permitida = ({ accion, children }: { accion: Accion; children: React.ReactNode }) => {
  const { rolNube } = useGranja();
  return puede(rolNube, accion) ? <>{children}</> : <Navigate to="/" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GranjaProvider>
        <Toaster />
        <Sonner />
        <Puerta>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/madres" element={<MadresPage />} />
            <Route path="/madres/nueva" element={<Permitida accion="crearMadre"><NuevaMadrePage /></Permitida>} />
            <Route path="/madres/:id" element={<DetalleMadrePage />} />
            <Route path="/madres/:id/nuevo-ciclo" element={<NuevoCicloPage />} />
            <Route path="/madres/:id/ciclo/:cicloId" element={<DetalleCicloPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/reportes" element={<Permitida accion="verReportes"><ReportesPage /></Permitida>} />
            <Route path="/reportes/fechas" element={<Permitida accion="verReportes"><FechasPage /></Permitida>} />
            <Route path="/ajustes" element={<AjustesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
        </Puerta>
      </GranjaProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
