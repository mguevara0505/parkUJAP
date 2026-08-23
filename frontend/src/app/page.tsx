import { redirect } from 'next/navigation';

/**
 * La raíz no tiene contenido propio: el sistema arranca en el login.
 *
 * Lo normal es que `proxy.ts` resuelva antes esta ruta y mande a quien ya
 * tiene sesión a su panel. Esto es el respaldo para quien llega sin sesión.
 */
export default function RootPage() {
  redirect('/login');
}
