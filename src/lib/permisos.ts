// Permisos de la interfaz según el rol en la nube. El servidor los impone de verdad
// (triggers de supabase/migrations); esto solo evita mostrar o ejecutar lo prohibido.
import type { Ciclo } from '@/types';

export type RolNube = 'dueno' | 'operario' | null;

export type Accion =
  | 'ver'
  | 'crearMadre'
  | 'editarMadre'
  | 'descartarMadre'
  | 'crearCruce'
  | 'editarCruce'
  | 'registrarParto'
  | 'registrarDestete'
  | 'registrarFallo'
  | 'verReportes'
  | 'exportarImportar'
  | 'borrarDatos'
  | 'verDemo'
  | 'gestionarTrabajadores'
  | 'verAjustesGranja';

const ACCIONES_OPERARIO: ReadonlySet<Accion> = new Set<Accion>([
  'ver',
  'crearCruce',
  'registrarParto',
  'registrarDestete',
  'registrarFallo',
]);

// rol null = dueño, demo o sin nube: todo permitido.
export function puede(rol: RolNube, accion: Accion): boolean {
  return rol !== 'operario' || ACCIONES_OPERARIO.has(accion);
}

// El operario solo llena datos vacíos: parto, destete y fallo no se pueden registrar dos veces.
export function cicloVacioPara(accion: 'registrarParto' | 'registrarDestete' | 'registrarFallo', c: Ciclo): boolean {
  if (accion === 'registrarParto') return !c.fechaPartoReal && c.estadoCiclo === 'gestacion';
  if (accion === 'registrarDestete') return !c.fechaDestete && c.estadoCiclo === 'lactancia';
  return !c.fechaFallo && c.estadoCiclo === 'gestacion';
}
