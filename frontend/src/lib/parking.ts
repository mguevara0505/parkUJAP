/** Tipos y etiquetas compartidos del dominio de estacionamiento. */

export type SpaceStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'DISABLED'
  | 'MAINTENANCE';

export type SpaceType =
  | 'STANDARD'
  | 'VISITOR'
  | 'PROFESSOR'
  | 'STAFF'
  | 'ACCESSIBLE'
  | 'VIP'
  | 'MOTORCYCLE'
  | 'OTHER';

/**
 * Colores conceptuales de la sección 18. Cada estado lleva además icono y
 * etiqueta: la información nunca depende solo del color (secciones 18 y 47).
 */
export const STATUS_META: Record<
  SpaceStatus,
  { label: string; icon: string; className: string; fill: string }
> = {
  AVAILABLE: {
    label: 'Disponible',
    icon: '✓',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
    fill: '#22c55e',
  },
  OCCUPIED: {
    label: 'Ocupado',
    icon: '●',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    fill: '#ef4444',
  },
  RESERVED: {
    label: 'Reservado',
    icon: '★',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    fill: '#3b82f6',
  },
  DISABLED: {
    label: 'Deshabilitado',
    icon: '✕',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    fill: '#64748b',
  },
  MAINTENANCE: {
    label: 'Mantenimiento',
    icon: '⚠',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    fill: '#eab308',
  },
};

export const TYPE_LABELS: Record<SpaceType, string> = {
  STANDARD: 'Estándar',
  VISITOR: 'Visitante',
  PROFESSOR: 'Profesor',
  STAFF: 'Personal',
  ACCESSIBLE: 'Accesible',
  VIP: 'VIP',
  MOTORCYCLE: 'Motocicleta',
  OTHER: 'Otro',
};

/**
 * Categoría del miembro de la universidad. Decide en qué zonas puede
 * estacionarse; el rol (USER/ADMIN) decide qué puede hacer en el sistema.
 */
export type UserCategory = 'STUDENT' | 'PROFESSOR' | 'STAFF';

export const CATEGORY_LABELS: Record<UserCategory, string> = {
  STUDENT: 'Estudiantes',
  PROFESSOR: 'Profesores',
  STAFF: 'Administrativos',
};

export const CATEGORY_SINGULAR: Record<UserCategory, string> = {
  STUDENT: 'Estudiante',
  PROFESSOR: 'Profesor',
  STAFF: 'Administrativo',
};

/**
 * Describe quién puede usar una zona. Una lista vacía significa que solo se
 * accede mediante una reserva administrativa.
 */
export function zoneAudience(allowedCategories: UserCategory[]): string {
  if (allowedCategories.length === 0) return 'Solo por reserva';
  return allowedCategories.map((c) => CATEGORY_LABELS[c]).join(' y ');
}

/** Escala de prioridad de la sección 17. */
export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Máxima',
  2: 'Alta',
  3: 'Normal',
  4: 'Baja',
};

/** Estados que un ADMIN puede fijar a mano; el resto los gestiona el backend. */
export const ADMIN_SETTABLE_STATUSES: SpaceStatus[] = [
  'AVAILABLE',
  'DISABLED',
  'MAINTENANCE',
];

/**
 * Puesto tal como lo devuelve GET /parking-spaces/map: exactamente los campos
 * necesarios para dibujarlo, sin relaciones (sección 46).
 */
export interface MapSpace {
  id: string;
  code: string;
  status: SpaceStatus;
  type: SpaceType;
  zoneId: string;
  priority: number;
  isAccessible: boolean;
  isCovered: boolean;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ParkingSpace {
  id: string;
  code: string;
  number: number;
  type: SpaceType;
  status: SpaceStatus;
  isAccessible: boolean;
  isCovered: boolean;
  priority: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zone?: {
    id: string;
    code: string;
    name: string;
    parkingLot?: { id: string; code: string; name: string };
  };
}
