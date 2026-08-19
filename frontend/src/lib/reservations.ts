/** Tipos y etiquetas de reservas (sección 11). */

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ReservationType =
  | 'VISITOR'
  | 'EVENT'
  | 'PROFESSOR'
  | 'AUTHORITY'
  | 'STAFF'
  | 'EXTERNAL'
  | 'OTHER';

export const RESERVATION_STATUS_META: Record<
  ReservationStatus,
  { label: string; icon: string; className: string }
> = {
  PENDING: {
    label: 'Pendiente',
    icon: '○',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  CONFIRMED: {
    label: 'Confirmada',
    icon: '★',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  ACTIVE: {
    label: 'En curso',
    icon: '●',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  COMPLETED: {
    label: 'Completada',
    icon: '✓',
    className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  },
  CANCELLED: {
    label: 'Cancelada',
    icon: '✕',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  NO_SHOW: {
    label: 'No se presentó',
    icon: '⚠',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
};

export const RESERVATION_TYPE_LABELS: Record<ReservationType, string> = {
  VISITOR: 'Visitante',
  EVENT: 'Evento',
  PROFESSOR: 'Profesor invitado',
  AUTHORITY: 'Autoridad',
  STAFF: 'Personal',
  EXTERNAL: 'Externo',
  OTHER: 'Otro',
};

/** Estados en los que la reserva todavía puede cancelarse o activarse. */
export const LIVE_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
];

export interface Reservation {
  id: string;
  title: string;
  description: string | null;
  reservationType: ReservationType;
  status: ReservationStatus;
  startAt: string;
  endAt: string;
  priority: number;
  vehiclePlate: string | null;
  parkingSpace: {
    id: string;
    code: string;
    priority: number;
    zone: { id: string; code: string; name: string };
  };
  visitor: {
    id: string;
    firstName: string;
    lastName: string;
    organization: string | null;
  } | null;
  user: { id: string; firstName: string; lastName: string } | null;
}

/**
 * `datetime-local` entrega "2026-11-25T08:00" sin zona horaria y la API espera
 * ISO 8601. `new Date()` interpreta ese texto en la zona del navegador, que es
 * lo que el administrador quiso decir.
 */
export function localInputToISO(value: string): string {
  return new Date(value).toISOString();
}

export function formatRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const fecha = start.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = (d: Date) =>
    d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const mismoDia = start.toDateString() === end.toDateString();

  return mismoDia
    ? `${fecha} · ${hora(start)} – ${hora(end)}`
    : `${fecha} ${hora(start)} → ${end.toLocaleDateString('es-VE')} ${hora(end)}`;
}
