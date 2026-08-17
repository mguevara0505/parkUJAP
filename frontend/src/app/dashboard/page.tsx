'use client';

import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

export default function UserDashboardPage() {
  const { user } = useAuthStore();

  return (
    <div>
      {/* Saludo */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Hola, {user?.firstName} 👋
        </h1>
        <p className="text-slate-400 mt-1">
          ¿En qué puesto te estacionaste hoy?
        </p>
      </div>

      {/* Estado actual */}
      <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-3xl">
            🚗
          </div>
          <div className="flex-1">
            <p className="text-slate-400 text-sm">Estacionamiento actual</p>
            <p className="text-white font-semibold text-lg mt-0.5">Sin sesión activa</p>
            <p className="text-slate-500 text-xs mt-1">
              No tienes ningún puesto registrado en este momento
            </p>
          </div>
          <Link
            href="/dashboard/map"
            id="btn-buscar-puesto"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all"
          >
            Buscar Puesto
          </Link>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: '✅', label: 'Disponibles', value: '—', desc: 'Puestos libres ahora' },
          { icon: '🔵', label: 'Tu zona', value: '—', desc: 'Zona más cercana' },
          { icon: '📋', label: 'Tus visitas', value: '—', desc: 'Total histórico' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/5 border border-white/10 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{stat.icon}</span>
              <span className="text-slate-400 text-sm">{stat.label}</span>
            </div>
            <p className="text-white text-2xl font-bold">{stat.value}</p>
            <p className="text-slate-500 text-xs mt-1">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/map"
          className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-2xl transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            🗺️
          </div>
          <div>
            <p className="text-white font-semibold">Ver Mapa</p>
            <p className="text-slate-400 text-sm">Visualiza todos los puestos disponibles</p>
          </div>
        </Link>

        <Link
          href="/dashboard/history"
          className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-2xl transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            📋
          </div>
          <div>
            <p className="text-white font-semibold">Mi Historial</p>
            <p className="text-slate-400 text-sm">Consulta tus registros anteriores</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
