import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { TipoCruce } from '@/types';
import { hoyISO } from '@/lib/fechas';

const NuevoCicloPage = () => {
  const { id: madreId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { obtenerMadre, proximoCiclo, iniciarCiclo } = useGranja();

  const madre = obtenerMadre(madreId!);
  const proximo = proximoCiclo(madreId!);

  const [formData, setFormData] = useState({
    fechaCruce: hoyISO(),
    tipoCruce: 'monta_natural' as TipoCruce,
    numeroVerraco: '',
    intento: proximo.intento,
    observaciones: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!madre) {
    return (
      <PageLayout>
        <div className="p-4 text-center">
          <p>Madre no encontrada</p>
          <Button onClick={() => navigate('/madres')}>Volver</Button>
        </div>
      </PageLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fechaCruce) {
      toast.error('La fecha de cruce es obligatoria');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nuevoCiclo = iniciarCiclo(madreId!, {
        fechaCruce: formData.fechaCruce,
        tipoCruce: formData.tipoCruce,
        numeroVerraco: formData.numeroVerraco.trim() || undefined,
        intento: formData.intento,
        observaciones: formData.observaciones.trim() || undefined,
      });
      
      toast.success('Ciclo iniciado correctamente');
      navigate(`/madres/${madreId}/ciclo/${nuevoCiclo.id}`);
    } catch (error) {
      toast.error('Error al iniciar el ciclo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <PageLayout>
      <div className="p-4 max-w-xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo Ciclo - {madre.arete}</CardTitle>
            <CardDescription>
              Ciclo #{proximo.numeroCiclo} · {formData.intento}° intento
              {proximo.intento > 1 && ' (el intento anterior no preñó)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fechaCruce">Fecha de Cruce / Monta *</Label>
                <Input
                  id="fechaCruce"
                  type="date"
                  value={formData.fechaCruce}
                  onChange={set('fechaCruce')}
                />
              </div>

              <div className="space-y-3">
                <Label>Tipo de Cruce</Label>
                <RadioGroup
                  value={formData.tipoCruce}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipoCruce: value as TipoCruce }))}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="monta"
                    className="flex items-center justify-center gap-2 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                  >
                    <RadioGroupItem value="monta_natural" id="monta" />
                    <span>Monta Natural</span>
                  </Label>
                  <Label
                    htmlFor="inseminacion"
                    className="flex items-center justify-center gap-2 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                  >
                    <RadioGroupItem value="inseminacion" id="inseminacion" />
                    <span>Inseminación</span>
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numeroVerraco">Verraco</Label>
                <Input
                  id="numeroVerraco"
                  placeholder="Nombre o referencia"
                  value={formData.numeroVerraco}
                  onChange={set('numeroVerraco')}
                />
              </div>

              <div className="space-y-3">
                <Label>Número de Intento</Label>
                <div className="flex gap-2">
                  {Array.from({ length: Math.max(3, proximo.intento) }, (_, i) => i + 1).map(num => (
                    <Button
                      key={num}
                      type="button"
                      variant={formData.intento === num ? 'default' : 'outline'}
                      className="flex-1 h-12"
                      onClick={() => setFormData(prev => ({ ...prev, intento: num }))}
                    >
                      {num}° Intento
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas sobre el cruce..."
                  value={formData.observaciones}
                  onChange={set('observaciones')}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
                <Check className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Guardando...' : 'Iniciar Ciclo'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default NuevoCicloPage;
