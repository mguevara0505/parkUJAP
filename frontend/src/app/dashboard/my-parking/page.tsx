'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/admin-ui';
import { QuickCheckIn } from '@/components/parking/QuickCheckIn';
import { ReleaseButton } from '@/components/parking/ReleaseButton';
import { TYPE_LABELS } from '@/lib/parking';
import {
  formatDateTime,
  formatDuration,
  useActiveSessions,
} from '@/lib/sessions';

/** Pantalla 05 — Mi estacionamiento (CU-004). */
export default function MyParkingPage() {
  const { sessions, limit, canRegisterMore, loaded, error, reload } =
    useActiveSessions();

  // Un tick por minuto basta para "2 h 15 min"
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!loaded) {
    return <p className="text-slate-400 text-sm">Cargando…</p>;
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-white">Mi Estacionamiento</h1>
        <p className="text-slate-400 mt-1">
          {sessions.length === 0
            ? 'No tiene ningún puesto registrado'
            : `${sessions.length} de ${limit} ${limit === 1 ? 'puesto' : 'puestos'} en uso`}
        </p>
      </header>

      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-5 max-w-2xl">
        {sessions.map((session) => (
          <article
            key={session.id}
            className="bg-gradient-to-br from-green-600/15 to-green-800/5 border border-green-500/20 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  Puesto
                </p>
                <p className="text-4xl font-bold text-white font-mono">
                  {session.parkingSpace.code}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
                ● Estacionado
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 mb-5">
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

            <ReleaseButton session={session} onLiberado={reload} />
          </article>
        ))}

        {/*
          Registrar se hace aquí mismo escribiendo el código, sin mandar a la
          persona al mapa a buscar un puesto que ya tiene delante.
        */}
        {canRegisterMore && <QuickCheckIn onRegistrado={reload} />}
      </div>
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
