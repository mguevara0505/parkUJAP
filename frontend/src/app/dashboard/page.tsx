'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useParkingMap } from '@/components/parking/use-parking-map';
import { QuickCheckIn } from '@/components/parking/QuickCheckIn';
import { ReleaseButton } from '@/components/parking/ReleaseButton';
import { formatDuration, useActiveSessions } from '@/lib/sessions';
import { CATEGORY_SINGULAR } from '@/lib/parking';

/**
 * Pantalla 02 — Inicio del estudiante.
 *
 * Se organiza por lo que la persona viene a hacer, no por lo que el sistema
 * sabe. Solo hay dos situaciones: acaba de estacionarse y quiere registrarlo,
 * o ya está registrado y quiere irse. Lo que corresponda ocupa la pantalla; el
 * resto queda debajo.
 */
export default function UserDashboardPage() {
  const { user } = useAuthStore();
  const { sessions, limit, canRegisterMore, loaded, reload } =
    useActiveSessions();
  const { counts, total, zones, reload: reloadMapa } = useParkingMap();

  // Un tick por minuto para que «hace 20 min» no se quede congelado
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Tras registrar o liberar se refrescan las dos cosas: la sesión propia y
  // el contador de libres. Si no, la pantalla diría «999 libres» justo después
  // de que uno mismo ocupara uno.
  const refrescarTodo = async () => {
    await Promise.all([reload(), reloadMapa()]);
  };

  const disponibles = counts.AVAILABLE ?? 0;
  const category = user?.category;
  const misZonas = category
    ? zones.filter((z) => z.allowedCategories.includes(category))
    : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">
        Hola, {user?.firstName} 👋
      </h1>

      {/* Lo que está estacionado ahora mismo, con su botón de salir al lado */}
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-gradient-to-br from-green-600/20 to-green-800/5 border border-green-500/25 rounded-2xl p-5 sm:p-6"
        >
          <p className="text-green-300 text-sm font-medium">
            Está estacionado en
          </p>
          <p className="text-white text-4xl font-mono font-bold mt-1">
            {session.parkingSpace.code}
          </p>
          <p className="text-slate-300 mt-1">
            {session.parkingSpace.zone.name} · hace{' '}
            {formatDuration(session.checkInAt)}
          </p>

          <div className="mt-5">
            <ReleaseButton
              session={session}
              onLiberado={refrescarTodo}
              tamano="grande"
            />
          </div>
        </div>
      ))}

      {/* Registrar: la acción principal cuando todavía no hay nada que liberar */}
      {loaded && canRegisterMore && (
        <>
          <QuickCheckIn onRegistrado={refrescarTodo} />

          <Link
            href="/dashboard/map"
            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-colors"
          >
            <span className="text-2xl">🗺️</span>
            <div className="flex-1">
              <p className="text-white font-semibold">
                No sé dónde estacionarme
              </p>
              <p className="text-slate-400 text-sm">
                Ver el mapa con los puestos libres
              </p>
            </div>
            <span className="text-slate-500">›</span>
          </Link>
        </>
      )}

      {/* Ya usó su cupo: no se ofrece registrar, se explica por qué */}
      {loaded && !canRegisterMore && sessions.length > 0 && (
        <p className="text-slate-400 text-sm px-1">
          Tiene {sessions.length === 1 ? 'su puesto' : `sus ${limit} puestos`}{' '}
          registrado{sessions.length > 1 ? 's' : ''}. Libere uno para registrar
          otro.
        </p>
      )}

      {/* Contexto útil, en una línea y no en tres tarjetas */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400 px-1">
        <span>
          <span className="text-white font-semibold tabular-nums">
            {total > 0 ? disponibles.toLocaleString('es-VE') : '—'}
          </span>{' '}
          puestos libres ahora
        </span>
        {category && misZonas.length > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span>
              Como {CATEGORY_SINGULAR[category].toLowerCase()} puede usar{' '}
              <span className="text-white font-semibold">
                {misZonas.map((z) => z.code).join(', ')}
              </span>
            </span>
          </>
        )}
      </div>

      <Link
        href="/dashboard/history"
        className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-colors"
      >
        <span className="text-xl">📋</span>
        <span className="text-slate-300 text-sm flex-1">
          Mis estacionamientos anteriores
        </span>
        <span className="text-slate-500">›</span>
      </Link>
    </div>
  );
}
