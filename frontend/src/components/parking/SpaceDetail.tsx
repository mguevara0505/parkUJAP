'use client';

import {
  ADMIN_SETTABLE_STATUSES,
  PRIORITY_LABELS,
  STATUS_META,
  TYPE_LABELS,
  type SpaceStatus,
  type SpaceType,
} from '@/lib/parking';

/** Campos que necesita el panel, presentes tanto en el mapa como en el CRUD. */
export interface DetailSpace {
  id: string;
  code: string;
  status: SpaceStatus;
  type: SpaceType;
  priority: number;
  isAccessible: boolean;
  isCovered: boolean;
}

interface Props {
  space: DetailSpace | null;
  zoneLabel?: string;
  lotLabel?: string;
  /** Solo el ADMIN recibe acciones; el usuario ve el panel en modo lectura. */
  onChangeStatus?: (status: SpaceStatus) => void;
  onDisable?: () => void;
  emptyHint?: string;
  children?: React.ReactNode;
}

export function SpaceDetail({
  space,
  zoneLabel,
  lotLabel,
  onChangeStatus,
  onDisable,
  emptyHint = 'Seleccione un puesto del mapa para ver sus datos.',
  children,
}: Props) {
  if (!space) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-2 text-sm">
          Detalle del puesto
        </h2>
        <p className="text-slate-400 text-sm">{emptyHint}</p>
      </div>
    );
  }

  const meta = STATUS_META[space.status];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            Puesto
          </p>
          <p className="text-2xl font-bold text-white font-mono">{space.code}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.className}`}
        >
          {meta.icon} {meta.label}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        {zoneLabel && <Row label="Zona" value={zoneLabel} />}
        {lotLabel && <Row label="Estacionamiento" value={lotLabel} />}
        <Row label="Tipo" value={TYPE_LABELS[space.type]} />
        <Row
          label="Prioridad"
          value={PRIORITY_LABELS[space.priority] ?? String(space.priority)}
        />
        <Row label="Accesible" value={space.isAccessible ? 'Sí ♿' : 'No'} />
        <Row label="Cubierto" value={space.isCovered ? 'Sí' : 'No'} />
      </dl>

      {onChangeStatus && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Cambiar estado
          </p>
          <div className="flex flex-wrap gap-2">
            {ADMIN_SETTABLE_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => onChangeStatus(status)}
                disabled={space.status === status}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STATUS_META[status].className}`}
              >
                {STATUS_META[status].icon} {STATUS_META[status].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Ocupado y Reservado no se fijan a mano: los gestionan el registro de
            ocupación y las reservas.
          </p>
        </div>
      )}

      {onDisable && space.status !== 'DISABLED' && (
        <button
          onClick={onDisable}
          className="mt-3 w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/10 transition-colors"
        >
          Deshabilitar puesto
        </button>
      )}

      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-white text-right">{value}</dd>
    </div>
  );
}
