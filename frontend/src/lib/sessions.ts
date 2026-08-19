'use client';

import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { api } from './api';
import type { SpaceType } from './parking';

export interface ParkingSession {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  checkInAt: string;
  checkOutAt: string | null;
  notes: string | null;
  parkingSpace: {
    id: string;
    code: string;
    type: SpaceType;
    isCovered: boolean;
    isAccessible: boolean;
    zone: {
      id: string;
      code: string;
      name: string;
      parkingLot: { id: string; code: string; name: string };
    };
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<{ message?: string }>;
  return axiosErr?.response?.data?.message ?? fallback;
}

/** Formatea una duración en "2 h 15 min", como pide la pantalla 05. */
export function formatDuration(fromISO: string, toISO?: string | null): string {
  const from = new Date(fromISO).getTime();
  const to = toISO ? new Date(toISO).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.floor((to - from) / 60000));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ActivePayload {
  /** Cuántos puestos puede tener a la vez, según su categoría. */
  limit: number;
  sessions: ParkingSession[];
}

/**
 * Puestos que el usuario tiene registrados ahora.
 *
 * `loaded` distingue "todavía cargando" de "ninguno": sin él se mostraría
 * "no tiene puesto" un instante antes de que llegue la respuesta.
 */
export function useActiveSessions() {
  const [state, setState] = useState<ActivePayload>({ limit: 1, sessions: [] });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<{ data: ActivePayload }>(
      '/parking-sessions/me/active',
    );
    return data.data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void load()
      .then((payload) => {
        if (!cancelled) setState(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err, 'No se pudo consultar su estacionamiento'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    try {
      setState(await load());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo consultar su estacionamiento'));
    }
  }, [load]);

  return {
    sessions: state.sessions,
    limit: state.limit,
    /** Si ya llegó a su tope, no tiene sentido ofrecerle registrar otro. */
    canRegisterMore: state.sessions.length < state.limit,
    loaded,
    error,
    reload,
  };
}
