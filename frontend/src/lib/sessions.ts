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

/**
 * Sesión activa del usuario. `null` significa "sin sesión"; `undefined`,
 * "todavía cargando" — distinguirlos evita mostrar "no tienes puesto" un
 * instante antes de que llegue la respuesta.
 */
export function useActiveSession() {
  const [session, setSession] = useState<ParkingSession | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<{ data: ParkingSession | null }>(
      '/parking-sessions/me/active',
    );
    return data.data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void load()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSession(null);
          setError(errorMessage(err, 'No se pudo consultar su estacionamiento'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    try {
      setSession(await load());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo consultar su estacionamiento'));
    }
  }, [load]);

  return { session, error, reload, setSession };
}
