import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const NuevaMadrePage = () => {
  const navigate = useNavigate();
  const { agregarMadre } = useGranja();
  
  const [formData, setFormData] = useState({
    arete: '',
    fechaNacimiento: '',
    observaciones: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.arete.trim()) {
      toast.error('El arete es obligatorio');
      return;
    }

    setIsSubmitting(true);
    
    try {
      agregarMadre({
        arete: formData.arete.trim().toUpperCase(),
        fechaNacimiento: formData.fechaNacimiento || undefined,
        estado: 'vacia',
        observaciones: formData.observaciones.trim() || undefined,
      });
      
      toast.success('Madre registrada correctamente');
      navigate('/madres');
    } catch (error) {
      toast.error('Error al registrar la madre');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Nueva Madre</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="arete">Arete / Identificador *</Label>
                <Input
                  id="arete"
                  placeholder="Ej: M-001"
                  value={formData.arete}
                  onChange={(e) => setFormData(prev => ({ ...prev, arete: e.target.value }))}
                  className="text-lg"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fechaNacimiento"
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas adicionales..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Registrar Madre'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default NuevaMadrePage;
