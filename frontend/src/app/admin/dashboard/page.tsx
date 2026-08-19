'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Alert } from '@/components/admin-ui';
import { errorMessage } from '@/lib/sessions';
import { STATUS_META, zoneAudience, type UserCategory } from '@/lib/parking';

interface Summary {
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  disabledSpaces: number;
  maintenanceSpaces: number;
  occupancyRate: number;
  availableRate: number;
  reservationsToday: number;
  activeSessions: number;
}

interface ZoneRow {
  id: string;
  code: string;
  name: string;
  allowedCategories: UserCategory[];
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  maintenanceSpaces: number;
  occupancyRate: number;
}

/** Pantalla A01 — Dashboard administrativo (CU-013). */
export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      api.get<{ data: Summary }>('/dashboard/summary'),
      api.get<{ data: ZoneRow[] }>('/dashboard/zones'),
    ])
      .then(([s, z]) => {
        if (cancelled) return;
        setSummary(s.data.data);
        setZones(z.data.data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'No se pudo cargar el panel'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Panel de control</h1>
        <p className="text-slate-400 mt-1">
          Universidad José Antonio Páez — estado del estacionamiento
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading && !summary && (
        <p className="text-slate-400 text-sm">Cargando indicadores…</p>
      )}

      {summary && (
        <>
          {/* KPIs de la sección 22 */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <Kpi
              label="Total de puestos"
              value={summary.totalSpaces}
              icon="🅿️"
              className="bg-white/5 border-white/10 text-slate-300"
            />
            <Kpi
              label="Disponibles"
              value={summary.availableSpaces}
              icon={STATUS_META.AVAILABLE.icon}
              className={STATUS_META.AVAILABLE.className}
            />
            <Kpi
              label="Ocupados"
              value={summary.occupiedSpaces}
              icon={STATUS_META.OCCUPIED.icon}
              className={STATUS_META.OCCUPIED.className}
            />
            <Kpi
              label="Reservados"
              value={summary.reservedSpaces}
              icon={STATUS_META.RESERVED.icon}
              className={STATUS_META.RESERVED.className}
            />
            <Kpi
              label="Deshabilitados"
              value={summary.disabledSpaces}
              icon={STATUS_META.DISABLED.icon}
              className={STATUS_META.DISABLED.className}
            />
            <Kpi
              label="Mantenimiento"
              value={summary.maintenanceSpaces}
              icon={STATUS_META.MAINTENANCE.icon}
              className={STATUS_META.MAINTENANCE.className}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Ocupación global */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">
                Ocupación global
              </h2>
              <div className="flex items-center gap-5">
                <OccupancyRing rate={summary.occupancyRate} />
                <dl className="space-y-1.5 text-sm">
                  <Row
                    label="Ocupados"
                    value={`${summary.occupiedSpaces.toLocaleString('es-VE')} (${summary.occupancyRate}%)`}
                  />
                  <Row
                    label="Libres"
                    value={`${summary.availableSpaces.toLocaleString('es-VE')} (${summary.availableRate}%)`}
                  />
                  <Row
                    label="Sesiones activas"
                    value={summary.activeSessions.toLocaleString('es-VE')}
                  />
                </dl>
              </div>
            </section>

            {/* Hoy */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Hoy</h2>
              <p className="text-4xl font-bold text-white tabular-nums">
                {summary.reservationsToday.toLocaleString('es-VE')}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {summary.reservationsToday === 1
                  ? 'reserva cubre algún momento de hoy'
                  : 'reservas cubren algún momento de hoy'}
              </p>
              <Link
                href="/admin/reservations"
                className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Ver reservas →
              </Link>
            </section>

            {/* Fuera de servicio */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">
                Fuera de servicio
              </h2>
              <p className="text-4xl font-bold text-white tabular-nums">
                {(
                  summary.maintenanceSpaces + summary.disabledSpaces
                ).toLocaleString('es-VE')}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {summary.maintenanceSpaces} en mantenimiento ·{' '}
                {summary.disabledSpaces} deshabilitados
              </p>
              <Link
                href="/admin/maintenance"
                className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Ver bloqueos →
              </Link>
            </section>
          </div>

          {/* Ocupación por zona */}
          <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <h2 className="text-white font-semibold p-6 pb-4">
              Ocupación por zona
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Ocupación por zona</caption>
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left px-6 py-3">Zona</th>
                    <th scope="col" className="text-left px-6 py-3">Para</th>
                    <th scope="col" className="text-right px-6 py-3">Total</th>
                    <th scope="col" className="text-right px-6 py-3">Libres</th>
                    <th scope="col" className="text-right px-6 py-3">Ocupados</th>
                    <th scope="col" className="text-left px-6 py-3 w-48">
                      Ocupación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {zones.map((zone) => (
                    <tr key={zone.id}>
                      <td className="px-6 py-3">
                        <span className="font-mono text-blue-400">
                          {zone.code}
                        </span>{' '}
                        <span className="text-slate-400">{zone.name}</span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">
                        {zoneAudience(zone.allowedCategories)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-300 tabular-nums">
                        {zone.totalSpaces}
                      </td>
                      <td className="px-6 py-3 text-right text-green-400 tabular-nums">
                        {zone.availableSpaces}
                      </td>
                      <td className="px-6 py-3 text-right text-red-400 tabular-nums">
                        {zone.occupiedSpaces}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"
                            role="img"
                            aria-label={`${zone.occupancyRate}% de ocupación`}
                          >
                            <div
                              className="h-full bg-red-500/70 rounded-full"
                              style={{ width: `${zone.occupancyRate}%` }}
                            />
                          </div>
                          {/* El número acompaña a la barra: no depender del color */}
                          <span className="text-xs text-slate-400 tabular-nums w-9 text-right">
                            {zone.occupancyRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: string;
  className: string;
}) {
  return (
    <div className={`border rounded-2xl p-5 ${className}`}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white tabular-nums">
        {value.toLocaleString('es-VE')}
      </div>
      <div className="text-xs font-medium opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

/** Anillo de ocupación con el porcentaje escrito dentro (secciones 18 y 47). */
function OccupancyRing({ rate }: { rate: number }) {
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeDasharray={`${rate} 100`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-lg tabular-nums">
          {rate}%
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-white tabular-nums">{value}</dd>
    </div>
  );
}
