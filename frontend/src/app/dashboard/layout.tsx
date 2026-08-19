'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { SessionLoading } from '@/components/admin-ui';

const userNav = [
  { href: '/dashboard', icon: '🏠', label: 'Inicio' },
  { href: '/dashboard/map', icon: '🗺️', label: 'Mapa de Puestos' },
  { href: '/dashboard/my-parking', icon: '🚗', label: 'Mi Estacionamiento' },
  { href: '/dashboard/history', icon: '📋', label: 'Historial' },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hydrated } = useAuthStore();

  useEffect(() => {
    // Esperar la rehidratación: antes de ella `user` siempre es null
    if (!hydrated) return;
    if (!user) router.push('/login');
  }, [hydrated, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!hydrated) return <SessionLoading />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top navbar */}
      <header className="bg-slate-900 border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-base">🅿️</span>
            </div>
            <span className="text-white font-bold text-sm">UJAP Parking</span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {userNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-xs font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-slate-500 text-xs">Universitario</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-300">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <button
              id="btn-user-logout"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition-colors text-sm p-1"
              title="Cerrar sesión"
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
