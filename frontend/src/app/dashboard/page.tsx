'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useCrud } from '@/lib/use-crud';
import { useParkingMap } from '@/components/parking/use-parking-map';
import {
  formatDuration,
  useActiveSession,
  type ParkingSession,
} from '@/lib/sessions';

/** Pantalla 02 — Inicio del usuario universitario. */
export default function UserDashboardPage() {
  const { user } = useAuthStore();
  const { session } = useActiveSession();
  const { counts, total, zones } = useParkingMap();
  const { total: visits } = useCrud<ParkingSession>(
    '/parking-sessions/me/history',
    '?limit=1',
  );

  const available = counts.AVAILABLE ?? 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Hola, {user?.firstName} 👋
        </h1>
        <p className="text-slate-400 mt-1">
          {session
            ? 'Este es su estacionamiento actual'
            : '¿En qué puesto se estacionó hoy?'}
        </p>
      </div>

      {/* Estado actual */}
      <div
        className={`border rounded-2xl p-6 mb-6 ${
          session
            ? 'bg-gradient-to-br from-green-600/15 to-green-800/5 border-green-500/20'
            : 'bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/20'
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
            🚗
          </div>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-slate-400 text-sm">Estacionamiento actual</p>
            {session ? (
              <>
                <p className="text-white font-semibold text-lg mt-0.5">
                  Puesto{' '}
                  <span className="font-mono">{session.parkingSpace.code}</span>{' '}
                  · {session.parkingSpace.zone.name}
                </p>
                <p className="text-green-400 text-xs mt-1">
                  Estacionado hace {formatDuration(session.checkInAt)}
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-lg mt-0.5">
                  Sin sesión activa
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  No tiene ningún puesto registrado en este momento
                </p>
              </>
            )}
          </div>
          <Link
            href={session ? '/dashboard/my-parking' : '/dashboard/map'}
            id="btn-buscar-puesto"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all"
          >
            {session ? 'Ver / liberar' : 'Buscar Puesto'}
          </Link>
        </div>
      </div>

      {/* Disponibilidad real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat
          icon="✅"
          label="Disponibles"
          value={total > 0 ? available.toLocaleString('es-VE') : '—'}
          desc={
            total > 0
              ? `de ${total.toLocaleString('es-VE')} puestos`
              : 'Cargando…'
          }
        />
        <Stat
          icon="🔠"
          label="Zonas"
          value={zones.length > 0 ? String(zones.length) : '—'}
          desc="Zonas del campus"
        />
        <Stat
          icon="📋"
          label="Sus visitas"
          value={visits.toLocaleString('es-VE')}
          desc="Total histórico"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Action
          href="/dashboard/map"
          icon="🗺️"
          title="Ver Mapa"
          desc="Visualiza todos los puestos disponibles"
          tone="green"
        />
        <Action
          href="/dashboard/history"
          icon="📋"
          title="Mi Historial"
          desc="Consulta sus registros anteriores"
          tone="purple"
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  desc,
}: {
  icon: string;
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <p className="text-white text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-slate-500 text-xs mt-1">{desc}</p>
    </div>
  );
}

function Action({
  href,
  icon,
  title,
  desc,
  tone,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  tone: 'green' | 'purple';
}) {
  const tones = {
    green: 'bg-green-500/10 border-green-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-2xl transition-all group"
    >
      <div
        className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${tones[tone]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-white font-semibold">{title}</p>
        <p className="text-slate-400 text-sm">{desc}</p>
      </div>
    </Link>
  );
}
