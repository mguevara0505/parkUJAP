'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCrud } from '@/lib/use-crud';
import { Alert, Field, SelectField } from '@/components/admin-ui';
import { errorMessage } from '@/lib/sessions';
import {
  LIVE_STATUSES,
  RESERVATION_STATUS_META,
  RESERVATION_TYPE_LABELS,
  formatRange,
  localInputToISO,
  type Reservation,
  type ReservationType,
} from '@/lib/reservations';
import { fullName, type Visitor } from '@/lib/visitors';

const PAGE_SIZE = 20;

interface BestSpace {
  id: string;
  code: string;
  priority: number;
}

const EMPTY = {
  code: '',
  title: '',
  reservationType: 'VISITOR' as ReservationType,
  startAt: '',
  endAt: '',
  vehiclePlate: '',
  visitorId: '',
};

/** Pantalla A04 — Reservas administrativas. */
export default function AdminReservationsPage() {
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    return `?${params.toString()}`;
  }, [filters, page]);

  const { items, total, loading, error, reload } = useCrud<Reservation>(
    '/reservations',
    query,
  );

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [best, setBest] = useState<BestSpace[]>([]);

  // Sección 16 — la reserva del evento se hace a nombre de un visitante
  const { items: visitors } = useCrud<Visitor>('/visitors', '?limit=100');

  // US-007 — sugerir los mejores puestos para autoridades y profesores (§17)
  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ data: { spaces: BestSpace[] } }>(
        '/parking-spaces/available?maxPriority=1',
      )
      .then(({ data }) => {
        if (!cancelled) setBest(data.data.spaces.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setBest([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      // El administrador piensa en códigos (A-001), no en UUID
      const { data } = await api.get<{ data: { id: string } }>(
        `/parking-spaces/code/${form.code.trim().toUpperCase()}`,
      );

      await api.post('/reservations', {
        parkingSpaceId: data.data.id,
        title: form.title,
        reservationType: form.reservationType,
        startAt: localInputToISO(form.startAt),
        endAt: localInputToISO(form.endAt),
        ...(form.vehiclePlate && { vehiclePlate: form.vehiclePlate }),
        ...(form.visitorId && { visitorId: form.visitorId }),
      });

      setForm(EMPTY);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo crear la reserva'));
    } finally {
      setSaving(false);
    }
  };

  const action = async (id: string, verb: 'cancel' | 'activate' | 'complete') => {
    try {
      await api.post(`/reservations/${id}/${verb}`);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo actualizar la reserva'));
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reservas</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'reserva registrada' : 'reservas registradas'}
        </p>
      </header>

      {/* Alta */}
      <form
        onSubmit={submit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Nueva reserva</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            id="res-code"
            label="Código del puesto"
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="J-001"
            required
            hint="El puesto se identifica por su código rotulado"
          />
          <div className="md:col-span-2">
            <Field
              id="res-title"
              label="Motivo"
              value={form.title}
              onChange={(title) => setForm({ ...form, title })}
              placeholder="Acto de graduación — Prof. Juan Pérez"
              required
              minLength={3}
            />
          </div>

          <SelectField
            id="res-type"
            label="Tipo"
            value={form.reservationType}
            onChange={(v) =>
              setForm({ ...form, reservationType: v as ReservationType })
            }
            options={Object.entries(RESERVATION_TYPE_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
            placeholder="Seleccione…"
            required
          />

          <DateTimeField
            id="res-start"
            label="Desde"
            value={form.startAt}
            onChange={(startAt) => setForm({ ...form, startAt })}
          />
          <DateTimeField
            id="res-end"
            label="Hasta"
            value={form.endAt}
            onChange={(endAt) => setForm({ ...form, endAt })}
          />

          <Field
            id="res-plate"
            label="Placa del vehículo"
            value={form.vehiclePlate}
            onChange={(vehiclePlate) => setForm({ ...form, vehiclePlate })}
            placeholder="ABC123"
          />

          <div className="md:col-span-2">
            <SelectField
              id="res-visitor"
              label="Visitante"
              value={form.visitorId}
              onChange={(visitorId) => {
                // Al elegir visitante se hereda su placa si aún no se escribió
                const visitor = visitors.find((v) => v.id === visitorId);
                setForm((f) => ({
                  ...f,
                  visitorId,
                  vehiclePlate:
                    f.vehiclePlate || (visitor?.vehiclePlate ?? ''),
                }));
              }}
              options={visitors.map((v) => ({
                value: v.id,
                label: `${fullName(v)}${v.organization ? ` — ${v.organization}` : ''}`,
              }))}
              placeholder="Sin visitante asociado"
            />
          </div>
        </div>

        {visitors.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Para reservar a nombre de alguien externo, regístrelo primero en{' '}
            <Link
              href="/admin/visitors"
              className="text-blue-400 hover:text-blue-300"
            >
              Visitantes
            </Link>
            .
          </p>
        )}

        {/* US-007 — mejores puestos disponibles */}
        {best.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Mejores puestos libres ahora (prioridad máxima)
            </p>
            <div className="flex flex-wrap gap-2">
              {best.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setForm({ ...form, code: space.code })}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-white/10 transition-colors"
                >
                  {space.code}
                </button>
              ))}
            </div>
          </div>
        )}

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-reservation"
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Crear reserva'}
        </button>
      </form>

      {/* Filtros */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            id="res-filter-status"
            label="Estado"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(RESERVATION_STATUS_META).map(
              ([value, meta]) => ({ value, label: `${meta.icon} ${meta.label}` }),
            )}
            placeholder="Todos"
          />
          <div>
            <label
              htmlFor="res-search"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Buscar
            </label>
            <input
              id="res-search"
              type="search"
              value={filters.search}
              placeholder="Motivo, placa o código de puesto"
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      {/* Listado */}
      <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

        {error && (
          <div className="p-6">
            <Alert>{error}</Alert>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="p-6 text-slate-400 text-sm">
            No hay reservas que coincidan con los filtros.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Reservas registradas</caption>
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3">Puesto</th>
                    <th scope="col" className="text-left px-4 py-3">Motivo</th>
                    <th scope="col" className="text-left px-4 py-3">Tipo</th>
                    <th scope="col" className="text-left px-4 py-3">Período</th>
                    <th scope="col" className="text-left px-4 py-3">Para</th>
                    <th scope="col" className="text-left px-4 py-3">Placa</th>
                    <th scope="col" className="text-left px-4 py-3">Estado</th>
                    <th scope="col" className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((r) => {
                    const meta = RESERVATION_STATUS_META[r.status];
                    const live = LIVE_STATUSES.includes(r.status);

                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono text-blue-400">
                          {r.parkingSpace.code}
                        </td>
                        <td className="px-4 py-3 text-white">{r.title}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {RESERVATION_TYPE_LABELS[r.reservationType]}
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {formatRange(r.startAt, r.endAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {r.visitor
                            ? fullName(r.visitor)
                            : r.user
                              ? fullName(r.user)
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono">
                          {r.vehiclePlate ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
                          >
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {live ? (
                            <div className="flex gap-3 justify-end">
                              {r.status !== 'ACTIVE' && (
                                <button
                                  onClick={() => void action(r.id, 'activate')}
                                  className="text-green-400 hover:text-green-300 text-xs font-medium"
                                >
                                  Activar
                                </button>
                              )}
                              <button
                                onClick={() => void action(r.id, 'complete')}
                                className="text-slate-400 hover:text-white text-xs font-medium"
                              >
                                Completar
                              </button>
                              <button
                                onClick={() => void action(r.id, 'cancel')}
                                className="text-slate-400 hover:text-red-400 text-xs font-medium"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Paginación"
                className="flex items-center justify-between px-4 py-3 border-t border-white/5"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Campo nativo de fecha y hora: sin librerías de calendario. */
function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-300 mb-1.5"
      >
        {label}
        <span className="text-red-400"> *</span>
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
      />
    </div>
  );
}
