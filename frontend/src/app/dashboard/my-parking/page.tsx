'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Alert } from '@/components/admin-ui';
import { TYPE_LABELS } from '@/lib/parking';
import {
  errorMessage,
  formatDateTime,
  formatDuration,
  useActiveSessions,
  type ParkingSession,
} from '@/lib/sessions';

/** Pantalla 05 — Mi estacionamiento (CU-004). */
export default function MyParkingPage() {
  const { sessions, limit, canRegisterMore, loaded, error, reload } =
    useActiveSessions();

  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Un tick por minuto basta para "2 h 15 min"
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const release = async (session: ParkingSession) => {
    setReleasingId(session.id);
    setActionError(null);

    try {
      await api.post(`/parking-sessions/${session.id}/check-out`);
      await reload();
      setConfirmingId(null);
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo liberar el puesto'));
    } finally {
      setReleasingId(null);
    }
  };

  if (!loaded) {
    return <p className="text-slate-400 text-sm">Cargando…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi Estacionamiento</h1>
        <p className="text-slate-400 mt-1">
          {sessions.length === 0
            ? 'No tiene ningún puesto registrado'
            : `${sessions.length} de ${limit} ${limit === 1 ? 'puesto disponible' : 'puestos disponibles'} para usted`}
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {actionError && (
        <div className="mb-6">
          <Alert>{actionError}</Alert>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🚗</div>
          <p className="text-white font-semibold mb-1">
            Sin estacionamiento activo
          </p>
          <p className="text-slate-400 text-sm mb-6">
            Cuando se estacione, regístrelo desde el mapa para no olvidar dónde
            quedó.
          </p>
          <Link
            href="/dashboard/map"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Buscar puesto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="bg-gradient-to-br from-green-600/15 to-green-800/5 border border-green-500/20 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Puesto
                  </p>
                  <p className="text-4xl font-bold text-white font-mono">
                    {session.parkingSpace.code}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/25">
                  ● Estacionado
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-4 mb-6">
                <Item
                  label="Zona"
                  value={`${session.parkingSpace.zone.code} — ${session.parkingSpace.zone.name}`}
                />
                <Item
                  label="Hora de entrada"
                  value={formatDateTime(session.checkInAt)}
                />
                <Item
                  label="Tiempo estacionado"
                  value={formatDuration(session.checkInAt)}
                  highlight
                />
                <Item
                  label="Tipo"
                  value={TYPE_LABELS[session.parkingSpace.type]}
                />
              </dl>

              {confirmingId === session.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    ¿Confirma que se retira del puesto{' '}
                    <span className="font-mono text-white">
                      {session.parkingSpace.code}
                    </span>
                    ? Quedará disponible para otros.
                  </p>
                  <div className="flex gap-2">
                    <button
                      id={`btn-confirmar-liberar-${session.parkingSpace.code}`}
                      onClick={() => void release(session)}
                      disabled={releasingId === session.id}
                      className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white text-sm font-bold transition-colors"
                    >
                      {releasingId === session.id ? 'Liberando…' : 'Sí, liberar'}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={releasingId === session.id}
                      className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id={`btn-liberar-${session.parkingSpace.code}`}
                  onClick={() => setConfirmingId(session.id)}
                  className="w-full px-4 py-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold tracking-wide transition-colors"
                >
                  SALIR / LIBERAR PUESTO
                </button>
              )}
            </article>
          ))}

          {/* Solo se ofrece registrar otro si el tope lo permite */}
          {canRegisterMore && (
            <Link
              href="/dashboard/map"
              className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-white/5 transition-all text-center"
            >
              <span className="text-3xl">＋</span>
              <span className="text-white font-semibold text-sm">
                Registrar otro puesto
              </span>
              <span className="text-slate-500 text-xs">
                Puede tener {limit} a la vez
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd
        className={
          highlight ? 'text-green-400 font-semibold' : 'text-white text-sm'
        }
      >
        {value}
      </dd>
    </div>
  );
}
