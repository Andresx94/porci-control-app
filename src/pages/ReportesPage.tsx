import { useMemo } from 'react';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, TrendingDown, Users } from 'lucide-react';

const ReportesPage = () => {
  const { madres, ciclos } = useGranja();

  const reportes = useMemo(() => {
    const madresActivas = madres.filter(m => m.estado !== 'descartada');
    const ciclosFinalizados = ciclos.filter(c => c.estadoCiclo === 'finalizado');
    
    // Promedio de crías vivas por parto
    const ciclosConParto = ciclosFinalizados.filter(c => c.nacidosVivos !== undefined);
    const promedioCriasVivas = ciclosConParto.length > 0
      ? (ciclosConParto.reduce((sum, c) => sum + (c.nacidosVivos || 0), 0) / ciclosConParto.length).toFixed(1)
      : '0';

    // Tasa de mortalidad al nacimiento
    const totalNacidos = ciclosConParto.reduce((sum, c) => sum + (c.nacidosTotales || 0), 0);
    const totalMuertosNacimiento = ciclosConParto.reduce((sum, c) => sum + (c.nacidosMuertos || 0), 0);
    const tasaMortalidadNacimiento = totalNacidos > 0
      ? ((totalMuertosNacimiento / totalNacidos) * 100).toFixed(1)
      : '0';

    // Tasa de mortalidad en lactancia
    const totalVivos = ciclosConParto.reduce((sum, c) => sum + (c.nacidosVivos || 0), 0);
    const totalMuertosLactancia = ciclosFinalizados.reduce((sum, c) => sum + (c.muertesLactancia || 0), 0);
    const tasaMortalidadLactancia = totalVivos > 0
      ? ((totalMuertosLactancia / totalVivos) * 100).toFixed(1)
      : '0';

    // Promedio de crías destetadas
    const ciclosConDestete = ciclosFinalizados.filter(c => c.destetados !== undefined);
    const promedioDestetados = ciclosConDestete.length > 0
      ? (ciclosConDestete.reduce((sum, c) => sum + (c.destetados || 0), 0) / ciclosConDestete.length).toFixed(1)
      : '0';

    // Ciclos por madre (promedio)
    const promedioCiclosPorMadre = madresActivas.length > 0
      ? (ciclos.filter(c => madresActivas.some(m => m.id === c.madreId)).length / madresActivas.length).toFixed(1)
      : '0';

    // Mejores madres por productividad
    const productividadPorMadre = madresActivas.map(madre => {
      const ciclosMadre = ciclosFinalizados.filter(c => c.madreId === madre.id);
      const totalDestetados = ciclosMadre.reduce((sum, c) => sum + (c.destetados || 0), 0);
      return {
        madre,
        ciclos: ciclosMadre.length,
        totalDestetados,
        promedioDestetados: ciclosMadre.length > 0 ? totalDestetados / ciclosMadre.length : 0,
      };
    }).sort((a, b) => b.promedioDestetados - a.promedioDestetados);

    return {
      totalMadresActivas: madresActivas.length,
      totalCiclosFinalizados: ciclosFinalizados.length,
      promedioCriasVivas,
      tasaMortalidadNacimiento,
      tasaMortalidadLactancia,
      promedioDestetados,
      promedioCiclosPorMadre,
      topMadres: productividadPorMadre.slice(0, 5),
    };
  }, [madres, ciclos]);

  return (
    <PageLayout title="Reportes">
      <div className="p-4 space-y-4">
        {/* Resumen general */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Resumen General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-foreground">{reportes.totalMadresActivas}</p>
                <p className="text-xs text-muted-foreground">Madres Activas</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-foreground">{reportes.totalCiclosFinalizados}</p>
                <p className="text-xs text-muted-foreground">Ciclos Completados</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-foreground">{reportes.promedioCiclosPorMadre}</p>
                <p className="text-xs text-muted-foreground">Ciclos/Madre</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-foreground">{reportes.promedioDestetados}</p>
                <p className="text-xs text-muted-foreground">Prom. Destetados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productividad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Productividad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
              <span className="text-sm">Promedio crías vivas/parto</span>
              <span className="font-bold text-lg">{reportes.promedioCriasVivas}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
              <span className="text-sm">Promedio destetados/ciclo</span>
              <span className="font-bold text-lg">{reportes.promedioDestetados}</span>
            </div>
          </CardContent>
        </Card>

        {/* Mortalidad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Mortalidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
              <span className="text-sm">Al nacimiento</span>
              <span className="font-bold text-lg">{reportes.tasaMortalidadNacimiento}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
              <span className="text-sm">En lactancia</span>
              <span className="font-bold text-lg">{reportes.tasaMortalidadLactancia}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Madres */}
        {reportes.topMadres.length > 0 && reportes.topMadres.some(m => m.ciclos > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Madres Productivas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportes.topMadres
                  .filter(m => m.ciclos > 0)
                  .map((item, index) => (
                    <div
                      key={item.madre.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{item.madre.arete}</p>
                          <p className="text-xs text-muted-foreground">{item.ciclos} ciclos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{item.promedioDestetados.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">destetados/ciclo</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {madres.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Registra madres y ciclos para ver reportes</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ReportesPage;
