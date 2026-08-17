import type { ReservationStatus, ReservationType } from './reservations';

export interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  vehiclePlate: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  notes: string | null;
  _count?: { reservations: number };
}

/** Detalle con historial, tal como lo devuelve GET /visitors/:id. */
export interface VisitorDetail extends Visitor {
  reservations: {
    id: string;
    title: string;
    status: ReservationStatus;
    reservationType: ReservationType;
    startAt: string;
    endAt: string;
    vehiclePlate: string | null;
    parkingSpace: { id: string; code: string; zone: { code: string; name: string } };
  }[];
}

export function fullName(v: { firstName: string; lastName: string }): string {
  return `${v.firstName} ${v.lastName}`;
}

/** "Toyota Corolla Gris", omitiendo lo que no se registró. */
export function vehicleSummary(v: Visitor): string {
  const parts = [v.vehicleBrand, v.vehicleModel, v.vehicleColor].filter(Boolean);
  if (parts.length === 0) return v.vehiclePlate ?? '—';
  return `${parts.join(' ')}${v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}`;
}
