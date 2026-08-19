'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useCrud } from '@/lib/use-crud';
import { Alert, Field, SelectField } from '@/components/admin-ui';
import { errorMessage } from '@/lib/sessions';
import { formatRange, localInputToISO } from '@/lib/reservations';
import {
  LIVE_MAINTENANCE,
  MAINTENANCE_STATUS_META,
  REASON_ICONS,
  REASON_LABELS,
  type MaintenanceBlock,
  type MaintenanceReason,
} from '@/lib/maintenance';

const PAGE_SIZE = 20;

const EMPTY = {
  code: '',
  reason: 'PAINTING' as MaintenanceReason,
  startAt: '',
  endAt: '',
  description: '',
};

/** Pantalla A06 — Mantenimiento (CU-009, CU-010). */
export default function AdminMaintenancePage() {
  const [filters, setFilters] = useState({ status: '', reason: '' });
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filters.status) params.set('status', filters.status);
    if (filters.reason) params.set('reason', filters.reason);
    return `?${params.toString()}`;
  }, [filters, page]);

  const { items, total, loading, error, reload } = useCrud<MaintenanceBlock>(
    '/maintenance-blocks',
    query,
  );

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  /** Rellena las fechas para el caso más común: bloquear ahora mismo. */
  const blockNow = (hours: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setForm((f) => ({
      ...f,
      startAt: local(new Date()),
      endAt: local(new Date(Date.now() + hours * 3_600_000)),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      // El administrador piensa en códigos de puesto, no en UUID
      const { data } = await api.get<{ data: { id: string } }>(
        `/parking-spaces/code/${form.code.trim().toUpperCase()}`,
      );

      await api.post('/maintenance-blocks', {
        parkingSpaceId: data.data.id,
        reason: form.reason,
        startAt: localInputToISO(form.startAt),
        endAt: localInputToISO(form.endAt),
        ...(form.description && { description: form.description }),
      });

      setForm(EMPTY);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo crear el bloqueo'));
    } finally {
      setSaving(false);
    }
  };

  const action = async (id: string, verb: 'cancel' | 'complete') => {
    try {
      await api.post(`/maintenance-blocks/${id}/${verb}`);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo actualizar el bloqueo'));
    }
  };

  const enCurso = items.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mantenimiento</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'bloqueo registrado' : 'bloqueos registrados'}
          {enCurso > 0 && ` · ${enCurso} en curso en esta página`}
        </p>
      </header>

      {/* Alta */}
      <form
        onSubmit={submit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Bloquear un puesto</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field
            id="mb-code"
            label="Código del puesto"
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="A-001"
            required
          />
          <SelectField
            id="mb-reason"
            label="Motivo"
            value={form.reason}
            onChange={(v) =>
              setForm({ ...form, reason: v as MaintenanceReason })
            }
            options={Object.entries(REASON_LABELS).map(([value, label]) => ({
              value,
              label: `${REASON_ICONS[value as MaintenanceReason]} ${label}`,
            }))}
            required
          />
          <DateTimeField
            id="mb-start"
            label="Desde"
            value={form.startAt}
            onChange={(startAt) => setForm({ ...form, startAt })}
          />
          <DateTimeField
            id="mb-end"
            label="Hasta"
            value={form.endAt}
            onChange={(endAt) => setForm({ ...form, endAt })}
          />
          <div className="md:col-span-4">
            <Field
              id="mb-desc"
              label="Descripción"
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              placeholder="Repintado de líneas y numeración"
            />
          </div>
        </div>

        {/* Atajos: bloquear ahora es el caso habitual */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Bloquear desde ahora por
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '4 horas', hours: 4 },
              { label: '1 día', hours: 24 },
              { label: '3 días', hours: 72 },
              { label: '1 semana', hours: 168 },
            ].map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => blockNow(preset.hours)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-white/10 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Todo bloqueo lleva fecha de fin: así ningún puesto se queda fuera de
            servicio porque nadie recordó reactivarlo.
          </p>
        </div>

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-block"
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Bloquear puesto'}
        </button>
      </form>

      {/* Filtros */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            id="mb-filter-status"
            label="Estado"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(MAINTENANCE_STATUS_META).map(
              ([value, meta]) => ({
                value,
                label: `${meta.icon} ${meta.label}`,
              }),
            )}
            placeholder="Todos"
          />
          <SelectField
            id="mb-filter-reason"
            label="Motivo"
            value={filters.reason}
            onChange={(v) => setFilter('reason', v)}
            options={Object.entries(REASON_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            placeholder="Todos"
          />
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
            No hay bloqueos que coincidan con los filtros.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Bloqueos de mantenimiento</caption>
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3">Puesto</th>
                    <th scope="col" className="text-left px-4 py-3">Motivo</th>
                    <th scope="col" className="text-left px-4 py-3">Período</th>
                    <th scope="col" className="text-left px-4 py-3">Descripción</th>
                    <th scope="col" className="text-left px-4 py-3">Estado</th>
                    <th scope="col" className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((b) => {
                    const meta = MAINTENANCE_STATUS_META[b.status];
                    const live = LIVE_MAINTENANCE.includes(b.status);

                    return (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-mono text-blue-400">
                          {b.parkingSpace.code}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {REASON_ICONS[b.reason]} {REASON_LABELS[b.reason]}
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {formatRange(b.startAt, b.endAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {b.description ?? '—'}
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
                              <button
                                onClick={() => void action(b.id, 'complete')}
                                className="text-green-400 hover:text-green-300 text-xs font-medium"
                              >
                                Reactivar puesto
                              </button>
                              <button
                                onClick={() => void action(b.id, 'cancel')}
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
