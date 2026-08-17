'use client';

import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { api } from './api';

interface Paginated<T> {
  data: T[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

/** Formato de error de la sección 31 del Documento Maestro. */
interface ApiError {
  message?: string;
}

function messageOf(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiError>;
  return axiosErr?.response?.data?.message ?? fallback;
}

/**
 * Listado paginado + mutaciones contra un endpoint REST del backend.
 * Recarga la lista después de cada mutación: con decenas de registros es más
 * simple y más correcto que mantener una copia local en sincronía.
 *
 * ponytail: sin TanStack Query todavía. Añadirlo cuando haya que invalidar
 * caché entre pantallas o refrescar el mapa de ~1.000 puestos (Sprint 4).
 */
export function useCrud<T>(endpoint: string, query = '') {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    const { data } = await api.get<Paginated<T>>(`${endpoint}${query}`);
    return data;
  }, [endpoint, query]);

  const apply = useCallback((page: Paginated<T>) => {
    setItems(page.data);
    setTotal(page.meta?.total ?? page.data.length);
    setError(null);
  }, []);

  // Carga inicial. El flag `cancelled` evita que una respuesta lenta de una
  // consulta anterior sobrescriba el resultado de la actual.
  useEffect(() => {
    let cancelled = false;

    void fetchPage()
      .then((page) => {
        if (!cancelled) apply(page);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'No se pudo cargar la información'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, apply]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      apply(await fetchPage());
    } catch (err) {
      setError(messageOf(err, 'No se pudo cargar la información'));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, apply]);

  /** Devuelve null si todo fue bien, o el mensaje de error para mostrar. */
  const mutate = useCallback(
    async (fn: () => Promise<unknown>, fallback: string) => {
      try {
        await fn();
        await reload();
        return null;
      } catch (err) {
        return messageOf(err, fallback);
      }
    },
    [reload],
  );

  return {
    items,
    total,
    loading,
    error,
    reload,
    create: (body: unknown) =>
      mutate(() => api.post(endpoint, body), 'No se pudo crear el registro'),
    patch: (id: string, body: unknown) =>
      mutate(
        () => api.patch(`${endpoint}/${id}`, body),
        'No se pudo actualizar el registro',
      ),
    remove: (id: string) =>
      mutate(
        () => api.delete(`${endpoint}/${id}`),
        'No se pudo desactivar el registro',
      ),
  };
}
