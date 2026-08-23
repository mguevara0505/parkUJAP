'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage, type ParkingSession } from '@/lib/sessions';

interface Props {
  session: ParkingSession;
  onLiberado: () => void | Promise<void>;
  /** `grande` para la acción principal de una pantalla. */
  tamano?: 'grande' | 'normal';
}

/**
 * Liberar el puesto, con confirmación en el sitio.
 *
 * La confirmación va dentro del propio botón en vez de en un window.confirm:
 * el diálogo del navegador en un teléfono tapa la pantalla entera y no dice
 * en qué puesto está uno. Aquí el código sigue a la vista mientras se decide.
 */
export function ReleaseButton({ session, onLiberado, tamano = 'normal' }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liberar = async () => {
    setLiberando(true);
    setError(null);
    try {
      await api.post(`/parking-sessions/${session.id}/check-out`);
      setConfirmando(false);
      await onLiberado();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo liberar el puesto'));
    } finally {
      setLiberando(false);
    }
  };

  const alto = tamano === 'grande' ? 'py-4' : 'py-3';

  if (!confirmando) {
    return (
      <div>
        <button
          id={`btn-liberar-${session.parkingSpace.code}`}
          onClick={() => setConfirmando(true)}
          className={`w-full px-4 ${alto} rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold tracking-wide transition-colors`}
        >
          SALIR / LIBERAR PUESTO
        </button>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-300 mb-2">
        ¿Ya sacó el carro de{' '}
        <span className="font-mono text-white">
          {session.parkingSpace.code}
        </span>
        ?
      </p>
      <div className="flex gap-2">
        <button
          id={`btn-confirmar-liberar-${session.parkingSpace.code}`}
          onClick={() => void liberar()}
          disabled={liberando}
          className={`flex-1 px-4 ${alto} rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white font-semibold transition-colors`}
        >
          {liberando ? 'Liberando…' : 'Sí, liberar'}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={liberando}
          className={`px-4 ${alto} rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors`}
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
