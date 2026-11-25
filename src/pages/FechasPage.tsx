import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/PageLayout';
import { useGranja } from '@/contexts/GranjaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Ciclo, Madre } from '@/types';
import { compararAretes, formatFecha, hoyISO, inicioMes, sumarDias } from '@/lib/fechas';
import { descargarExcel, imprimirPdf, Tabla } from '@/lib/exportar';

interface TipoFecha {
  id: string;
  etiqueta: string;
  corto: string;
  fecha: (c: Ciclo) => string | undefined;
  columnas: string[];
  extra: (c: Ciclo) => (string | number)[];
}

const vacio = (v?: number) => v ?? '';

// Los intentos que no preñaron no tienen parto, vacuna, enjaule ni destete.
const activo = (c: Ciclo) => c.estadoCiclo !== 'fallido';

const TIPOS: TipoFecha[] = [
  {
    id: 'parto_previsto',
    etiqueta: 'Posible fecha de parto',
    corto: 'partos-previstos',
    fecha: c => (activo(c) ? c.fechaPartoPrevista : undefined),
    columnas: ['Cruce', 'Parto real'],
    extra: c => [formatFecha(c.fechaCruce), c.fechaPartoReal ? formatFecha(c.fechaPartoReal) : 'Pendiente'],
  },
  {
    id: 'parto',
    etiqueta: 'Fecha de parto (nacimiento de lechones)',
    corto: 'partos',
    fecha: c => c.fechaPartoReal,
    columnas: ['Vivos', 'Muertos', 'Momias', 'Total'],
    extra: c => [vacio(c.nacidosVivos), vacio(c.nacidosMuertos), vacio(c.momias), vacio(c.nacidosTotales)],
  },
  {
    id: 'destete',
    etiqueta: 'Fecha de destete',
    corto: 'destetes',
    fecha: c => c.fechaDestete ?? (c.estadoCiclo === 'lactancia' ? c.fechaDestetePrevista : undefined),
    columnas: ['Real o previsto', 'Destetados', 'Peso prom. (kg)'],
    extra: c => [c.fechaDestete ? 'Real' : 'Previsto', vacio(c.destetados), vacio(c.pesoPromedioDestete)],
  },
  {
    id: 'enjaule',
    etiqueta: 'Fecha de enjaule',
    corto: 'enjaules',
    fecha: c => (activo(c) ? c.fechaEnjaule : undefined),
    columnas: ['Parto previsto'],
    extra: c => [formatFecha(c.fechaPartoPrevista)],
  },
  {
    id: 'vacuna',
    etiqueta: 'Fecha de vacuna Suicen',
    corto: 'vacunas',
    fecha: c => (activo(c) ? c.fechaVacunaSuicen : undefined),
    columnas: ['Parto previsto'],
    extra: c => [formatFecha(c.fechaPartoPrevista)],
  },
  {
    id: 'cruce',
    etiqueta: 'Fecha de cruce',
    corto: 'cruces',
    fecha: c => c.fechaCruce,
    columnas: ['Verraco', 'Tipo'],
    extra: c => [c.numeroVerraco ?? '', c.tipoCruce === 'inseminacion' ? 'Inseminación' : 'Monta natural'],
  },
];

const ESTADO_CICLO: Record<Ciclo['estadoCiclo'], string> = {
  cruce: 'Cruce',
  gestacion: 'Gestación',
  parto: 'Parto',
  lactancia: 'Maternidad',
  finalizado: 'Finalizado',
  fallido: 'No preñó',
};

function rangos(hoy: string) {
  return [
    { id: 'semana', etiqueta: 'Próximos 7 días', desde: hoy, hasta: sumarDias(hoy, 7) },
    { id: 'mes', etiqueta: 'Este mes', desde: inicioMes(hoy), hasta: sumarDias(inicioMes(hoy, 1), -1) },
    { id: 'siguiente', etiqueta: 'Próximo mes', desde: inicioMes(hoy, 1), hasta: sumarDias(inicioMes(hoy, 2), -1) },
    { id: 'anterior', etiqueta: 'Mes pasado', desde: inicioMes(hoy, -1), hasta: sumarDias(inicioMes(hoy), -1) },
  ];
}

interface Fila {
  ciclo: Ciclo;
  madre: Madre;
  fecha: string;
}

const FechasPage = () => {
  const navigate = useNavigate();
  const { madres, ciclos } = useGranja();
  const [params, setParams] = useSearchParams();
  const hoy = hoyISO();
  const atajos = rangos(hoy);

  const tipo = TIPOS.find(t => t.id === params.get('tipo')) ?? TIPOS[0];
  const desde = params.get('desde') || atajos[1].desde;
  const hasta = params.get('hasta') || atajos[1].hasta;

  const cambiar = (cambios: Record<string, string>) => {
    const siguiente = { tipo: tipo.id, desde, hasta, ...cambios };
    setParams(siguiente, { replace: true });
  };

  const filas: Fila[] = useMemo(() => {
    const porId = new Map(madres.map(m => [m.id, m]));
    return ciclos
      .map(ciclo => ({ ciclo, madre: porId.get(ciclo.madreId), fecha: tipo.fecha(ciclo) }))
      .filter((f): f is Fila => !!f.madre && !!f.fecha && f.fecha >= desde && f.fecha <= hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || compararAretes(a.madre.arete, b.madre.arete));
  }, [madres, ciclos, tipo, desde, hasta]);

  const rangoInvalido = desde > hasta;
  const titulo = `${tipo.etiqueta}: ${formatFecha(desde)} al ${formatFecha(hasta)}`;
  const nombreArchivo = `porcicontrol-${tipo.corto}-${desde}-a-${hasta}`;

  const tabla: Tabla = {
    columnas: ['Fecha', 'Arete', 'Ciclo', 'Intento', 'Estado', ...tipo.columnas],
    filas: filas.map(({ ciclo, madre, fecha }) => [
      formatFecha(fecha),
      madre.arete,
      ciclo.numeroCiclo,
      ciclo.intento,
      madre.estado === 'descartada' ? 'Descartada' : ESTADO_CICLO[ciclo.estadoCiclo],
      ...tipo.extra(ciclo),
    ]),
  };

  const exportar = (formato: 'excel' | 'pdf') => {
    if (filas.length === 0) {
      toast.error('No hay resultados para exportar');
      return;
    }
    if (formato === 'excel') descargarExcel(tabla, nombreArchivo);
    else imprimirPdf(nombreArchivo);
  };

  return (
    <PageLayout title="Buscar por fechas">
      <div className="p-4 space-y-4">
        {/* Filtros */}
        <div className="space-y-3 print:hidden">
          <div className="space-y-2">
            <Label htmlFor="tipoFecha">Buscar por</Label>
            <select
              id="tipoFecha"
              value={tipo.id}
              onChange={(e) => cambiar({ tipo: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
            >
              {TIPOS.map(t => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {atajos.map(r => (
              <Button
                key={r.id}
                size="sm"
                variant={desde === r.desde && hasta === r.hasta ? 'default' : 'outline'}
                className="flex-shrink-0"
                onClick={() => cambiar({ desde: r.desde, hasta: r.hasta })}
              >
                {r.etiqueta}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} />
            </div>
          </div>
          {rangoInvalido && <p className="text-sm text-destructive">"Desde" debe ser anterior a "Hasta".</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12" onClick={() => exportar('excel')}>
              <FileSpreadsheet className="h-5 w-5 mr-2" />
              Excel
            </Button>
            <Button variant="outline" className="h-12" onClick={() => exportar('pdf')}>
              <FileText className="h-5 w-5 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Título visible también en el PDF */}
        <div>
          <h2 className="font-semibold text-foreground">{titulo}</h2>
          <p className="text-sm text-muted-foreground">
            {filas.length} {filas.length === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>

        {/* Lista en pantalla */}
        <div className="space-y-2 print:hidden">
          {filas.map(({ ciclo, madre, fecha }) => (
            <button
              key={ciclo.id}
              onClick={() => navigate(`/madres/${madre.id}/ciclo/${ciclo.id}`)}
              className="w-full flex items-center gap-3 p-3 bg-card rounded-lg border border-border text-left hover:border-primary/30"
            >
              <div className="w-20 flex-shrink-0 text-sm font-semibold text-foreground">{formatFecha(fecha)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{madre.arete}</p>
                <p className="text-xs text-muted-foreground">
                  Ciclo #{ciclo.numeroCiclo} · {ciclo.intento}° intento · {madre.estado === 'descartada' ? 'Descartada' : ESTADO_CICLO[ciclo.estadoCiclo]}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {tipo.columnas.map((col, i) => `${col}: ${tipo.extra(ciclo)[i] === '' ? '—' : tipo.extra(ciclo)[i]}`).join(' · ')}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
          {filas.length === 0 && !rangoInvalido && (
            <p className="text-center py-8 text-muted-foreground">No hay fechas en este rango</p>
          )}
        </div>

        {/* Tabla solo para el PDF */}
        <table className="hidden w-full border-collapse text-xs print:table">
          <thead>
            <tr>{tabla.columnas.map(c => <th key={c} className="border border-black px-1 py-0.5 text-left">{c}</th>)}</tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => (
              <tr key={i}>{fila.map((v, j) => <td key={j} className="border border-black px-1 py-0.5">{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
};

export default FechasPage;
