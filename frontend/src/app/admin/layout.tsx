'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { SessionLoading } from '@/components/admin-ui';

const adminNav = [
  { href: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/admin/map', icon: '🗺️', label: 'Mapa de Puestos' },
  { href: '/admin/parking-lots', icon: '🏛️', label: 'Estacionamientos' },
  { href: '/admin/zones', icon: '🔠', label: 'Zonas' },
  { href: '/admin/reservations', icon: '📅', label: 'Reservas' },
  { href: '/admin/visitors', icon: '👥', label: 'Visitantes' },
  { href: '/admin/maintenance', icon: '🔧', label: 'Mantenimiento' },
  { href: '/admin/users', icon: '👤', label: 'Usuarios' },
  { href: '/admin/audit', icon: '📋', label: 'Auditoría' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAdmin, hydrated } = useAuthStore();

  useEffect(() => {
    // Esperar la rehidratación: antes de ella `user` siempre es null
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (!isAdmin()) { router.push('/dashboard'); }
  }, [hydrated, user, router, isAdmin]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!hydrated) return <SessionLoading />;
  if (!user || !isAdmin()) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-lg">🅿️</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">UJAP Parking</p>
              <p className="text-blue-400 text-xs">Administrador</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-300">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-slate-500 text-xs truncate">{user.email}</p>
            </div>
          </div>
          <button
            id="btn-admin-logout"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-sm transition-all"
          >
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
