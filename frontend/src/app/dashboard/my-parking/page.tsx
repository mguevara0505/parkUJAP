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
  useActiveSession,
} from '@/lib/sessions';

/** Pantalla 05 — Mi estacionamiento (CU-004). */
export default function MyParkingPage() {
  const { session, error, reload } = useActiveSession();
  const [releasing, setReleasing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cronómetro: un tick por minuto basta para "2 h 15 min"
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const release = async () => {
    if (!session) return;
    setReleasing(true);
    setActionError(null);

    try {
      await api.post(`/parking-sessions/${session.id}/check-out`);
      await reload();
      setConfirming(false);
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo liberar el puesto'));
    } finally {
      setReleasing(false);
    }
  };

  if (session === undefined) {
    return <p className="text-slate-400 text-sm">Cargando…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi Estacionamiento</h1>
        <p className="text-slate-400 mt-1">
          {session ? 'Tiene un puesto registrado' : 'No tiene ningún puesto registrado'}
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {!session ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🚗</div>
          <p className="text-white font-semibold mb-1">Sin estacionamiento activo</p>
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
        <div className="bg-gradient-to-br from-green-600/15 to-green-800/5 border border-green-500/20 rounded-2xl p-6 max-w-2xl">
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
              label="Estacionamiento"
              value={session.parkingSpace.zone.parkingLot.name}
            />
            <Item label="Hora de entrada" value={formatDateTime(session.checkInAt)} />
            <Item
              label="Tiempo estacionado"
              value={formatDuration(session.checkInAt)}
              highlight
            />
            <Item label="Tipo" value={TYPE_LABELS[session.parkingSpace.type]} />
            <Item
              label="Cubierto"
              value={session.parkingSpace.isCovered ? 'Sí' : 'No'}
            />
          </dl>

          {actionError && (
            <div className="mb-4">
              <Alert>{actionError}</Alert>
            </div>
          )}

          {confirming ? (
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
                  id="btn-confirmar-liberar"
                  onClick={() => void release()}
                  disabled={releasing}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white text-sm font-bold transition-colors"
                >
                  {releasing ? 'Liberando…' : 'Sí, liberar'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={releasing}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              id="btn-liberar-puesto"
              onClick={() => setConfirming(true)}
              className="w-full px-4 py-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold tracking-wide transition-colors"
            >
              SALIR / LIBERAR PUESTO
            </button>
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
