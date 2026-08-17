'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCrud } from '@/lib/use-crud';
import { Alert } from '@/components/admin-ui';
import {
  formatDateTime,
  formatDuration,
  type ParkingSession,
} from '@/lib/sessions';

const PAGE_SIZE = 20;

/** Pantalla 06 — Historial personal (CU-005). */
export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => `?page=${page}&limit=${PAGE_SIZE}`,
    [page],
  );

  const { items, total, loading, error } = useCrud<ParkingSession>(
    '/parking-sessions/me/history',
    query,
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Historial</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'registro' : 'registros'} de estacionamiento
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-white font-semibold mb-1">
              Todavía no hay registros
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Aquí aparecerán sus estacionamientos una vez que registre el
              primero.
            </p>
            <Link
              href="/dashboard/map"
              className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Buscar puesto
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Historial de estacionamientos
                </caption>
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3">Puesto</th>
                    <th scope="col" className="text-left px-4 py-3">Zona</th>
                    <th scope="col" className="text-left px-4 py-3">Entrada</th>
                    <th scope="col" className="text-left px-4 py-3">Salida</th>
                    <th scope="col" className="text-right px-4 py-3">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-mono text-blue-400">
                        {s.parkingSpace.code}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {s.parkingSpace.zone.code}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatDateTime(s.checkInAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {s.checkOutAt ? (
                          formatDateTime(s.checkOutAt)
                        ) : (
                          <span className="text-green-400">En curso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">
                        {formatDuration(s.checkInAt, s.checkOutAt)}
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
            )}
          </>
        )}
      </section>
    </div>
  );
}
