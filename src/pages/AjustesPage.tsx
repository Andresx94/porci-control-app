import { useState } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Download, Upload, Info } from 'lucide-react';
import { toast } from 'sonner';

const AjustesPage = () => {
  const { madres, ciclos } = useGranja();
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleExportData = () => {
    const data = {
      madres,
      ciclos,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `porcicontrol-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Datos exportados correctamente');
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.madres && data.ciclos) {
          localStorage.setItem('granja_madres', JSON.stringify(data.madres));
          localStorage.setItem('granja_ciclos', JSON.stringify(data.ciclos));
          toast.success('Datos importados. Recarga la página para ver los cambios.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error('Archivo inválido');
        }
      } catch (error) {
        toast.error('Error al importar datos');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    localStorage.removeItem('granja_madres');
    localStorage.removeItem('granja_ciclos');
    localStorage.removeItem('granja_alertas');
    toast.success('Datos eliminados');
    setShowResetDialog(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <PageLayout title="Ajustes">
      <div className="p-4 space-y-4">
        {/* Info de la app */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              PorciControl
            </CardTitle>
            <CardDescription>
              Sistema de control reproductivo porcino
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versión</span>
                <span>1.0.0 MVP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Madres registradas</span>
                <span>{madres.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ciclos totales</span>
                <span>{ciclos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Almacenamiento</span>
                <span>Local (dispositivo)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <CardTitle>Respaldo de Datos</CardTitle>
            <CardDescription>
              Exporta o importa los datos de tu granja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={handleExportData}
            >
              <Download className="h-5 w-5 mr-2" />
              Exportar Datos
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="w-full h-12"
              >
                <Upload className="h-5 w-5 mr-2" />
                Importar Datos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Zona de peligro */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
            <CardDescription>
              Acciones irreversibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full h-12"
              onClick={() => setShowResetDialog(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Eliminar Todos los Datos
            </Button>
          </CardContent>
        </Card>

        {/* Créditos */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Desarrollado para granjas porcinas</p>
          <p className="text-xs mt-1">Los datos se guardan localmente en tu dispositivo</p>
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar todos los datos?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todas las madres, ciclos y alertas. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleResetData}>
              Sí, eliminar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AjustesPage;
