/** Bloqueos y mantenimiento (sección 13). */

export type MaintenanceReason =
  | 'PAINTING'
  | 'MAINTENANCE'
  | 'CONSTRUCTION'
  | 'SECURITY'
  | 'EVENT'
  | 'OTHER';

export type MaintenanceStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export const REASON_LABELS: Record<MaintenanceReason, string> = {
  PAINTING: 'Pintura',
  MAINTENANCE: 'Reparación',
  CONSTRUCTION: 'Construcción',
  SECURITY: 'Seguridad',
  EVENT: 'Evento',
  OTHER: 'Otro',
};

export const REASON_ICONS: Record<MaintenanceReason, string> = {
  PAINTING: '🎨',
  MAINTENANCE: '🔧',
  CONSTRUCTION: '🚧',
  SECURITY: '🛡️',
  EVENT: '🎪',
  OTHER: '📌',
};

export const MAINTENANCE_STATUS_META: Record<
  MaintenanceStatus,
  { label: string; icon: string; className: string }
> = {
  SCHEDULED: {
    label: 'Programado',
    icon: '○',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  ACTIVE: {
    label: 'En curso',
    icon: '⚠',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  COMPLETED: {
    label: 'Finalizado',
    icon: '✓',
    className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  },
  CANCELLED: {
    label: 'Cancelado',
    icon: '✕',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

/** Estados en los que el bloqueo todavía puede cancelarse o completarse. */
export const LIVE_MAINTENANCE: MaintenanceStatus[] = ['SCHEDULED', 'ACTIVE'];

export interface MaintenanceBlock {
  id: string;
  reason: MaintenanceReason;
  status: MaintenanceStatus;
  description: string | null;
  startAt: string;
  endAt: string;
  parkingSpace: {
    id: string;
    code: string;
    status: string;
    zone: { id: string; code: string; name: string };
  };
  createdBy: { id: string; firstName: string; lastName: string } | null;
}
