import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ROUTES = ['/admin'];

// Next 16 renombró `middleware.ts` → `proxy.ts` (misma funcionalidad).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Corre en el servidor: no hay localStorage.
  // auth.store espeja el rol en la cookie `ujap-role` al iniciar/cerrar sesión.
  const role = request.cookies.get('ujap-role')?.value;
  const isAuthenticated = role === 'USER' || role === 'ADMIN';
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Sin sesión, todo lleva al login. La raíz incluida: el sistema arranca
  // ahí, no en una pantalla de presentación.
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Con sesión, ni el login ni la raíz tienen nada que mostrar: cada quien a
  // su panel según su rol.
  if (isAuthenticated && (isPublicRoute || pathname === '/')) {
    const redirectTo = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Proteger rutas de admin
  if (isAdminRoute && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
