'use client';

import { useMemo, useState } from 'react';
import { useCrud } from '@/lib/use-crud';
import { Alert, SelectField } from '@/components/admin-ui';
import {
  ADMIN_SETTABLE_STATUSES,
  PRIORITY_LABELS,
  STATUS_META,
  TYPE_LABELS,
  type ParkingSpace,
  type SpaceStatus,
} from '@/lib/parking';

interface Zone {
  id: string;
  code: string;
  name: string;
}

const PAGE_SIZE = 50;

export default function AdminSpacesPage() {
  const { items: zones } = useCrud<Zone>('/parking-zones', '?limit=100');

  const [filters, setFilters] = useState({
    zoneId: '',
    status: '',
    type: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ParkingSpace | null>(null);

  // El query se recalcula solo cuando cambia un filtro: useCrud lo usa como
  // dependencia del efecto de carga
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filters.zoneId) params.set('zoneId', filters.zoneId);
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    if (filters.search) params.set('search', filters.search);
    return `?${params.toString()}`;
  }, [filters, page]);

  const { items, total, loading, error, patch, remove } = useCrud<ParkingSpace>(
    '/parking-spaces',
    query,
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1); // Cambiar de filtro debe volver a la primera página
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const changeStatus = async (space: ParkingSpace, status: SpaceStatus) => {
    const err = await patch(space.id, { status });
    if (!err && selected?.id === space.id) {
      setSelected({ ...selected, status });
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Puestos</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')} puestos registrados
        </p>
      </header>

      {/* Filtros — pantalla A02 */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SelectField
            id="filter-zone"
            label="Zona"
            value={filters.zoneId}
            onChange={(v) => setFilter('zoneId', v)}
            options={zones.map((z) => ({
              value: z.id,
              label: `${z.code} — ${z.name}`,
            }))}
            placeholder="Todas"
          />
          <SelectField
            id="filter-status"
            label="Estado"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            placeholder="Todos"
          />
          <SelectField
            id="filter-type"
            label="Tipo"
            value={filters.type}
            onChange={(v) => setFilter('type', v)}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            placeholder="Todos"
          />
          <div>
            <label
              htmlFor="filter-search"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Buscar por código
            </label>
            <input
              id="filter-search"
              type="search"
              value={filters.search}
              placeholder="A-001"
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Listado */}
        <section className="xl:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

          {error && (
            <div className="p-6">
              <Alert>{error}</Alert>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="p-6 text-slate-400 text-sm">
              Ningún puesto coincide con los filtros.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Puestos de estacionamiento</caption>
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="text-left px-4 py-3">Código</th>
                      <th scope="col" className="text-left px-4 py-3">Zona</th>
                      <th scope="col" className="text-left px-4 py-3">Tipo</th>
                      <th scope="col" className="text-left px-4 py-3">Estado</th>
                      <th scope="col" className="text-left px-4 py-3">Prioridad</th>
                      <th scope="col" className="text-right px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map((space) => (
                      <tr
                        key={space.id}
                        className={
                          selected?.id === space.id ? 'bg-blue-500/10' : undefined
                        }
                      >
                        <td className="px-4 py-3 font-mono text-blue-400">
                          {space.code}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {space.zone?.code ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {TYPE_LABELS[space.type]}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={space.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {PRIORITY_LABELS[space.priority] ?? space.priority}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelected(space)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <nav
                aria-label="Paginación"
                className="flex items-center justify-between px-4 py-3 border-t border-white/5"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </nav>
            </>
          )}
        </section>

        {/* Detalle — pantalla A03 */}
        <aside className="bg-white/5 border border-white/10 rounded-2xl p-6 h-fit">
          <h2 className="text-white font-semibold mb-4">Detalle del puesto</h2>

          {!selected ? (
            <p className="text-slate-400 text-sm">
              Seleccione un puesto de la lista para ver sus datos y acciones.
            </p>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-2 text-sm">
                <Row label="Código" value={selected.code} mono />
                <Row
                  label="Zona"
                  value={
                    selected.zone
                      ? `${selected.zone.code} — ${selected.zone.name}`
                      : '—'
                  }
                />
                <Row
                  label="Estacionamiento"
                  value={selected.zone?.parkingLot?.name ?? '—'}
                />
                <Row label="Tipo" value={TYPE_LABELS[selected.type]} />
                <Row
                  label="Prioridad"
                  value={PRIORITY_LABELS[selected.priority] ?? String(selected.priority)}
                />
                <Row label="Accesible" value={selected.isAccessible ? 'Sí' : 'No'} />
                <Row label="Cubierto" value={selected.isCovered ? 'Sí' : 'No'} />
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-slate-400">Estado</dt>
                  <dd>
                    <StatusChip status={selected.status} />
                  </dd>
                </div>
              </dl>

              <div className="pt-4 border-t border-white/5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Cambiar estado
                </p>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_SETTABLE_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => void changeStatus(selected, status)}
                      disabled={selected.status === status}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STATUS_META[status].className}`}
                    >
                      {STATUS_META[status].icon} {STATUS_META[status].label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Ocupado y Reservado no se fijan a mano: los gestionan el
                  registro de ocupación y las reservas.
                </p>
              </div>

              {selected.status !== 'DISABLED' && (
                <button
                  onClick={() => void remove(selected.id)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/10 transition-colors"
                >
                  Deshabilitar puesto
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-white text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function StatusChip({ status }: { status: SpaceStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
    >
      {meta.icon} {meta.label}
    </span>
  );
}
