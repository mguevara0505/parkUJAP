'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import type { MapSpace, SpaceStatus, SpaceType } from '@/lib/parking';

export interface MapZone {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface MapPayload {
  total: number;
  bounds: { width: number; height: number };
  zones: MapZone[];
  spaces: MapSpace[];
}

/**
 * ResponseInterceptor del backend envuelve toda respuesta no paginada en
 * { success, data, timestamp }, así que el payload va un nivel más adentro.
 */
interface MapResponse {
  data: MapPayload;
}

export interface MapFilters {
  zoneId: string;
  status: SpaceStatus | '';
  type: SpaceType | '';
  onlyAvailable: boolean;
  onlyAccessible: boolean;
  onlyCovered: boolean;
}

export const EMPTY_FILTERS: MapFilters = {
  zoneId: '',
  status: '',
  type: '',
  onlyAvailable: false,
  onlyAccessible: false,
  onlyCovered: false,
};

/**
 * Carga el plano completo una sola vez y filtra en memoria.
 *
 * El endpoint /parking-spaces/map acepta los mismos filtros en el servidor,
 * pero refiltrar allí supondría volver a descargar ~260 KB en cada clic de un
 * checkbox. Con 1.000 puestos el filtrado en memoria es instantáneo, y el botón
 * de actualizar cubre el refresco explícito (sección 28: REST + refetch).
 */
export function useParkingMap(parkingLotId?: string) {
  const [all, setAll] = useState<MapSpace[]>([]);
  const [zones, setZones] = useState<MapZone[]>([]);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);

  const endpoint = parkingLotId
    ? `/parking-spaces/map?parkingLotId=${parkingLotId}`
    : '/parking-spaces/map';

  const fetchMap = useCallback(async () => {
    const { data } = await api.get<MapResponse>(endpoint);
    return data.data;
  }, [endpoint]);

  const apply = useCallback((payload: MapPayload) => {
    // Defensivo: si el contrato de la respuesta cambiara, la pantalla queda
    // vacía en lugar de reventar con "undefined is not a function"
    setAll(payload.spaces ?? []);
    setZones(payload.zones ?? []);
    setBounds(payload.bounds ?? { width: 0, height: 0 });
    setError(null);
  }, []);

  // `cancelled` evita que una respuesta lenta sobrescriba una más reciente
  useEffect(() => {
    let cancelled = false;

    void fetchMap()
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const axiosErr = err as AxiosError<{ message?: string }>;
          setError(
            axiosErr?.response?.data?.message ?? 'No se pudo cargar el mapa',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchMap, apply]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      apply(await fetchMap());
    } catch {
      setError('No se pudo actualizar el mapa');
    } finally {
      setLoading(false);
    }
  }, [fetchMap, apply]);

  const spaces = useMemo(
    () =>
      all.filter(
        (s) =>
          (!filters.zoneId || s.zoneId === filters.zoneId) &&
          (!filters.status || s.status === filters.status) &&
          (!filters.type || s.type === filters.type) &&
          (!filters.onlyAvailable || s.status === 'AVAILABLE') &&
          (!filters.onlyAccessible || s.isAccessible) &&
          (!filters.onlyCovered || s.isCovered),
      ),
    [all, filters],
  );

  /** Conteo por estado sobre el conjunto sin filtrar, para la leyenda. */
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const space of all) acc[space.status] = (acc[space.status] ?? 0) + 1;
    return acc;
  }, [all]);

  return {
    spaces,
    zones,
    bounds,
    counts,
    total: all.length,
    loading,
    error,
    filters,
    setFilters,
    reload,
    /** Refresca un puesto en memoria tras una mutación, sin recargar el plano. */
    patchSpace: useCallback((id: string, changes: Partial<MapSpace>) => {
      setAll((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...changes } : s)),
      );
    }, []),
  };
}
