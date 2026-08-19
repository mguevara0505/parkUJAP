'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useCrud } from '@/lib/use-crud';
import { Alert, SelectField } from '@/components/admin-ui';
import { formatDateTime } from '@/lib/sessions';

const PAGE_SIZE = 25;

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

/** Color por familia de acción, para leer la lista de un vistazo. */
function actionTone(action: string): string {
  if (action.endsWith('_CREATED'))
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (action.endsWith('_DISABLED') || action.includes('CANCEL'))
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (action.endsWith('_UPDATED'))
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
}

/** Pantalla A08 — Auditoría (CU-014). */
export default function AdminAuditPage() {
  const [filters, setFilters] = useState({ action: '', entityType: '', search: '' });
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.search) params.set('search', filters.search);
    return `?${params.toString()}`;
  }, [filters, page]);

  const { items, total, loading, error } = useCrud<AuditLog>(
    '/audit-logs',
    query,
  );

  // Las acciones existentes salen de la propia auditoría: el filtro no se
  // queda desactualizado cuando se añade un endpoint nuevo
  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ data: string[] }>('/audit-logs/actions')
      .then(({ data }) => {
        if (!cancelled) setActions(data.data);
      })
      .catch(() => {
        if (!cancelled) setActions([]);
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

  const entityTypes = [...new Set(items.map((i) => i.entityType))].sort();

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Auditoría</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'acción registrada' : 'acciones registradas'} · solo
          lectura
        </p>
      </header>

      {/* Filtros */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            id="au-action"
            label="Acción"
            value={filters.action}
            onChange={(v) => setFilter('action', v)}
            options={actions.map((a) => ({ value: a, label: a }))}
            placeholder="Todas"
          />
          <SelectField
            id="au-entity"
            label="Entidad"
            value={filters.entityType}
            onChange={(v) => setFilter('entityType', v)}
            options={entityTypes.map((e) => ({ value: e, label: e }))}
            placeholder="Todas"
          />
          <div>
            <label
              htmlFor="au-search"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Buscar
            </label>
            <input
              id="au-search"
              type="search"
              value={filters.search}
              placeholder="Acción, entidad o quien la realizó"
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

          {error && (
            <div className="p-6">
              <Alert>{error}</Alert>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="p-6 text-slate-400 text-sm">
              No hay acciones que coincidan con los filtros.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Registro de auditoría</caption>
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="text-left px-4 py-3">Fecha</th>
                      <th scope="col" className="text-left px-4 py-3">Quién</th>
                      <th scope="col" className="text-left px-4 py-3">Acción</th>
                      <th scope="col" className="text-left px-4 py-3">Entidad</th>
                      <th scope="col" className="text-right px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map((log) => (
                      <tr
                        key={log.id}
                        className={
                          detail?.id === log.id ? 'bg-blue-500/10' : undefined
                        }
                      >
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {log.user
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${actionTone(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetail(log)}
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

        {/* Detalle */}
        <aside className="bg-white/5 border border-white/10 rounded-2xl p-5 h-fit">
          <h2 className="text-white font-semibold mb-3 text-sm">
            Detalle de la acción
          </h2>

          {!detail ? (
            <p className="text-slate-400 text-sm">
              Elija «Ver» para inspeccionar qué se envió en esa operación.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <dl className="space-y-1.5">
                <Row label="Acción" value={detail.action} />
                <Row label="Entidad" value={detail.entityType} />
                <Row label="ID" value={detail.entityId ?? '—'} mono />
                <Row
                  label="Quién"
                  value={detail.user?.email ?? '—'}
                />
                <Row label="Cuándo" value={formatDateTime(detail.createdAt)} />
                <Row label="Dirección IP" value={detail.ipAddress ?? '—'} mono />
              </dl>

              {detail.newValue && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Datos enviados
                  </p>
                  <pre className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(detail.newValue, null, 2)}
                  </pre>
                  <p className="mt-2 text-xs text-slate-500">
                    Las contraseñas y los tokens se guardan como «[oculto]».
                  </p>
                </div>
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
    <div className="flex justify-between gap-4 py-0.5">
      <dt className="text-slate-400 shrink-0">{label}</dt>
      <dd
        className={`text-white text-right break-all ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
