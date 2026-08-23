'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { SessionLoading } from '@/components/admin-ui';

const userNav = [
  { href: '/dashboard', icon: '🏠', label: 'Inicio', short: 'Inicio' },
  { href: '/dashboard/map', icon: '🗺️', label: 'Mapa de Puestos', short: 'Mapa' },
  {
    href: '/dashboard/my-parking',
    icon: '🚗',
    label: 'Mi Estacionamiento',
    short: 'Mi puesto',
  },
  { href: '/dashboard/history', icon: '📋', label: 'Historial', short: 'Historial' },
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
          {/* Logo. El nombre se oculta en pantallas estrechas para dejarle
              sitio al botón de salir, que sí tiene que poder tocarse. */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <span className="text-base">🅿️</span>
            </div>
            <span className="text-white font-bold text-sm hidden sm:inline">
              UJAP Parking
            </span>
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

          {/* Usuario y salida */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-xs font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-slate-500 text-xs">Universitario</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-300">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </span>
            </div>
            {/*
              Con etiqueta y con 44 px de alto. Antes era un 🚪 suelto de
              27×28: en un teléfono no se acertaba, y sin texto tampoco se
              entendía qué hacía.
            */}
            <button
              id="btn-user-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-slate-300 hover:text-white hover:bg-red-500/15 active:bg-red-500/25 border border-white/10 hover:border-red-500/30 transition-colors text-sm font-medium"
            >
              <span aria-hidden="true">🚪</span>
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content. El padding inferior deja sitio a la barra fija del móvil */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 pb-28 md:pb-8">
        {children}
      </main>

      {/*
        Barra inferior en el teléfono.
        La navegación de arriba es `hidden md:flex`: sin esto, desde un móvil
        no había forma de llegar a ninguna pantalla salvo volviendo al inicio,
        y el teléfono es justo donde un estudiante usa esto.
      */}
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4">
          {userNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-[3.75rem] text-[0.7rem] font-medium transition-colors ${
                  isActive
                    ? 'text-blue-400'
                    : 'text-slate-400 active:text-white'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
