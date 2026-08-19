'use client';

import { STATUS_META, type SpaceStatus } from '@/lib/parking';

/**
 * Leyenda de estados (sección 18). Muestra color, icono, etiqueta y conteo:
 * la información nunca depende únicamente del color (sección 47).
 */
export function ParkingLegend({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const statuses = Object.keys(STATUS_META) as SpaceStatus[];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h2 className="text-white font-semibold mb-3 text-sm">Leyenda</h2>

      <ul className="space-y-2">
        {statuses.map((status) => {
          const meta = STATUS_META[status];
          const count = counts[status] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <li key={status} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="w-4 h-4 rounded shrink-0 border border-slate-900"
                style={{ backgroundColor: meta.fill }}
              />
              <span className="text-slate-300 flex-1">
                {meta.icon} {meta.label}
              </span>
              <span className="text-white font-semibold tabular-nums">
                {count.toLocaleString('es-VE')}
              </span>
              <span className="text-slate-500 text-xs tabular-nums w-10 text-right">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-400">
        Total: {total.toLocaleString('es-VE')} puestos
      </p>
    </div>
  );
}
