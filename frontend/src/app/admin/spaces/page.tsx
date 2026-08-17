'use client';

import { useMemo, useState } from 'react';
import { useCrud } from '@/lib/use-crud';
import { Alert, SelectField } from '@/components/admin-ui';
import { SpaceDetail } from '@/components/parking/SpaceDetail';
import {
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

        {/* Detalle — pantalla A03, mismo panel que usa el mapa */}
        <div className="h-fit">
          <SpaceDetail
            space={selected}
            zoneLabel={
              selected?.zone
                ? `${selected.zone.code} — ${selected.zone.name}`
                : undefined
            }
            lotLabel={selected?.zone?.parkingLot?.name}
            emptyHint="Seleccione un puesto de la lista para ver sus datos y acciones."
            onChangeStatus={(status) => {
              if (selected) void changeStatus(selected, status);
            }}
            onDisable={() => {
              if (selected) void remove(selected.id);
            }}
          />
        </div>
      </div>
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
