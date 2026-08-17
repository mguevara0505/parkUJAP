'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCrud } from '@/lib/use-crud';
import { Alert, Field } from '@/components/admin-ui';
import { errorMessage } from '@/lib/sessions';
import {
  RESERVATION_STATUS_META,
  formatRange,
} from '@/lib/reservations';
import {
  fullName,
  vehicleSummary,
  type Visitor,
  type VisitorDetail,
} from '@/lib/visitors';

const PAGE_SIZE = 20;

const EMPTY = {
  firstName: '',
  lastName: '',
  documentId: '',
  organization: '',
  phone: '',
  vehiclePlate: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleColor: '',
};

/** Pantalla A05 — Visitantes (CU-008). */
export default function AdminVisitorsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (search) params.set('search', search);
    return `?${params.toString()}`;
  }, [search, page]);

  const { items, total, loading, error, create, remove, reload } =
    useCrud<Visitor>('/visitors', query);

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Solo se envían los campos rellenados: la API rechaza cadenas vacías
    // donde espera un correo o una placa con formato
    const body = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v.trim() !== ''),
    );

    const err = await create(body);
    setSaving(false);
    setFormError(err);
    if (!err) setForm(EMPTY);
  };

  const openDetail = async (id: string) => {
    setDetailError(null);
    try {
      const { data } = await api.get<{ data: VisitorDetail }>(
        `/visitors/${id}`,
      );
      setDetail(data.data);
    } catch (err) {
      setDetailError(errorMessage(err, 'No se pudo cargar el visitante'));
    }
  };

  const deleteVisitor = async (id: string) => {
    const err = await remove(id);
    setDetailError(err);
    if (!err && detail?.id === id) setDetail(null);
  };

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Visitantes</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'visitante registrado' : 'visitantes registrados'}
        </p>
      </header>

      {/* Alta — visitante y su vehículo (sección 16, pasos 1 y 2) */}
      <form
        onSubmit={submit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Nuevo visitante</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            id="vis-first"
            label="Nombre"
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
            placeholder="Juan"
            required
            minLength={2}
          />
          <Field
            id="vis-last"
            label="Apellido"
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
            placeholder="Pérez"
            required
            minLength={2}
          />
          <Field
            id="vis-doc"
            label="Cédula o documento"
            value={form.documentId}
            onChange={(v) => setField('documentId', v)}
            placeholder="V-12345678"
            hint="Único: identifica al visitante cuando vuelve"
          />
          <Field
            id="vis-org"
            label="Institución"
            value={form.organization}
            onChange={(v) => setField('organization', v)}
            placeholder="Universidad de Carabobo"
          />
          <Field
            id="vis-phone"
            label="Teléfono"
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            placeholder="+58412-1234567"
          />
          <Field
            id="vis-plate"
            label="Placa"
            value={form.vehiclePlate}
            onChange={(v) => setField('vehiclePlate', v)}
            placeholder="ABC123"
          />
          <Field
            id="vis-brand"
            label="Marca"
            value={form.vehicleBrand}
            onChange={(v) => setField('vehicleBrand', v)}
            placeholder="Toyota"
          />
          <Field
            id="vis-model"
            label="Modelo"
            value={form.vehicleModel}
            onChange={(v) => setField('vehicleModel', v)}
            placeholder="Corolla"
          />
          <Field
            id="vis-color"
            label="Color"
            value={form.vehicleColor}
            onChange={(v) => setField('vehicleColor', v)}
            placeholder="Gris"
          />
        </div>

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-visitor"
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Crear visitante'}
        </button>
      </form>

      {/* Búsqueda */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <label
          htmlFor="vis-search"
          className="block text-sm font-medium text-slate-300 mb-1.5"
        >
          Buscar
        </label>
        <input
          id="vis-search"
          type="search"
          value={search}
          placeholder="Nombre, cédula, placa o institución"
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
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
              No hay visitantes que coincidan con la búsqueda.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Visitantes registrados</caption>
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="text-left px-4 py-3">Visitante</th>
                      <th scope="col" className="text-left px-4 py-3">Documento</th>
                      <th scope="col" className="text-left px-4 py-3">Institución</th>
                      <th scope="col" className="text-left px-4 py-3">Vehículo</th>
                      <th scope="col" className="text-right px-4 py-3">Reservas</th>
                      <th scope="col" className="text-right px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map((v) => (
                      <tr
                        key={v.id}
                        className={detail?.id === v.id ? 'bg-blue-500/10' : undefined}
                      >
                        <td className="px-4 py-3 text-white">{fullName(v)}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {v.documentId ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {v.organization ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {vehicleSummary(v)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                          {v._count?.reservations ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => void openDetail(v.id)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                            >
                              Historial
                            </button>
                            <button
                              onClick={() => void deleteVisitor(v.id)}
                              className="text-slate-400 hover:text-red-400 text-xs font-medium"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

        {/* Historial del visitante */}
        <aside className="bg-white/5 border border-white/10 rounded-2xl p-5 h-fit">
          <h2 className="text-white font-semibold mb-3 text-sm">
            Historial del visitante
          </h2>

          {detailError && (
            <div className="mb-3">
              <Alert>{detailError}</Alert>
            </div>
          )}

          {!detail ? (
            <p className="text-slate-400 text-sm">
              Elija «Historial» en la lista para ver los datos del visitante y
              sus reservas.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-white">
                  {fullName(detail)}
                </p>
                <p className="text-slate-400 text-sm">
                  {detail.organization ?? 'Sin institución registrada'}
                </p>
              </div>

              <dl className="space-y-1.5 text-sm">
                <Row label="Documento" value={detail.documentId ?? '—'} />
                <Row label="Teléfono" value={detail.phone ?? '—'} />
                <Row label="Vehículo" value={vehicleSummary(detail)} />
              </dl>

              <div className="pt-3 border-t border-white/5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Reservas ({detail.reservations.length})
                </p>

                {detail.reservations.length === 0 ? (
                  <p className="text-slate-500 text-xs">
                    Sin reservas todavía.{' '}
                    <Link
                      href="/admin/reservations"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Crear una
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.reservations.map((r) => {
                      const meta = RESERVATION_STATUS_META[r.status];
                      return (
                        <li
                          key={r.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/5"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-white text-sm">{r.title}</span>
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
                            >
                              {meta.icon} {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            <span className="font-mono text-blue-400">
                              {r.parkingSpace.code}
                            </span>{' '}
                            · {formatRange(r.startAt, r.endAt)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button
                onClick={() => void reload()}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ↻ Actualizar lista
              </button>
            </div>
          )}
        </aside>
      </div>
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
