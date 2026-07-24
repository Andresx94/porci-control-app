import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { GranjaProvider } from "@/contexts/GranjaContext";
import Dashboard from "./pages/Dashboard";
import MadresPage from "./pages/MadresPage";
import NuevaMadrePage from "./pages/NuevaMadrePage";
import DetalleMadrePage from "./pages/DetalleMadrePage";
import NuevoCicloPage from "./pages/NuevoCicloPage";
import DetalleCicloPage from "./pages/DetalleCicloPage";
import AlertasPage from "./pages/AlertasPage";
import ReportesPage from "./pages/ReportesPage";
import AjustesPage from "./pages/AjustesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GranjaProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/madres" element={<MadresPage />} />
            <Route path="/madres/nueva" element={<NuevaMadrePage />} />
            <Route path="/madres/:id" element={<DetalleMadrePage />} />
            <Route path="/madres/:id/nuevo-ciclo" element={<NuevoCicloPage />} />
            <Route path="/madres/:id/ciclo/:cicloId" element={<DetalleCicloPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/ajustes" element={<AjustesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </GranjaProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
