import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UJAP Parking — Sistema de Estacionamientos',
  description:
    'Plataforma de gestión y reserva de estacionamientos de la Universidad José Antonio Páez. Controla en tiempo real ~1.000 puestos de estacionamiento.',
  keywords: ['estacionamiento', 'universidad', 'UJAP', 'parking', 'reservas'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
