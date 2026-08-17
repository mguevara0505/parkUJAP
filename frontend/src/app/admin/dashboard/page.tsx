'use client';

import { useAuthStore } from '@/store/auth.store';

const kpiCards = [
  { icon: '🅿️', label: 'Total Puestos', value: '—', color: 'blue' },
  { icon: '✅', label: 'Disponibles', value: '—', color: 'green' },
  { icon: '🔴', label: 'Ocupados', value: '—', color: 'red' },
  { icon: '📅', label: 'Reservados', value: '—', color: 'purple' },
  { icon: '🚫', label: 'Deshabilitados', value: '—', color: 'gray' },
  { icon: '🔧', label: 'Mantenimiento', value: '—', color: 'yellow' },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  gray: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
};

export default function AdminDashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Bienvenido, {user?.firstName} 👋
        </h1>
        <p className="text-slate-400 mt-1">
          Panel de control — Universidad José Antonio Páez
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`border rounded-2xl p-5 ${colorMap[card.color]}`}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-xs font-medium opacity-80">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Ocupación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">📊 Ocupación Global</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3b82f6" strokeWidth="3"
                  strokeDasharray="0 100" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg">—%</span>
              </div>
            </div>
            <div className="text-sm text-slate-400">
              Los datos de ocupación estarán disponibles cuando se implemente el módulo de puestos (Sprint 3).
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">🕐 Actividad Reciente</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/3">
                <div className="w-8 h-8 rounded-lg bg-slate-700 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-700 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-slate-800 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
            <p className="text-center text-slate-500 text-xs mt-2">
              Disponible en Sprint 10 — Dashboard + Auditoría
            </p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">⚡ Acciones Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '📅', label: 'Nueva Reserva', href: '/admin/reservations' },
            { icon: '👥', label: 'Nuevo Visitante', href: '/admin/visitors' },
            { icon: '🔧', label: 'Mantenimiento', href: '/admin/maintenance' },
            { icon: '🗺️', label: 'Ver Mapa', href: '/admin/map' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-center group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {action.icon}
              </span>
              <span className="text-slate-300 text-xs font-medium">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
