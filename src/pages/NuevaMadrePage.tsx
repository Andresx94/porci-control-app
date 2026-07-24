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
    areteMadre: '',
    aretePadre: '',
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
        areteMadre: formData.areteMadre.trim().toUpperCase() || undefined,
        aretePadre: formData.aretePadre.trim().toUpperCase() || undefined,
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

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <PageLayout>
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
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
                  onChange={set('arete')}
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
                  onChange={set('fechaNacimiento')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="areteMadre">Arete de la Madre</Label>
                  <Input
                    id="areteMadre"
                    placeholder="Ej: M-010"
                    value={formData.areteMadre}
                    onChange={set('areteMadre')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aretePadre">Arete del Padre (Verraco)</Label>
                  <Input
                    id="aretePadre"
                    placeholder="Ej: V-002"
                    value={formData.aretePadre}
                    onChange={set('aretePadre')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas adicionales..."
                  value={formData.observaciones}
                  onChange={set('observaciones')}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
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
