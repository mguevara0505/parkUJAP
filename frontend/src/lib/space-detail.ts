'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { SpaceStatus, SpaceType, UserCategory } from './parking';

/**
 * Detalle de un puesto para la pantalla A03.
 *
 * Lo devuelve entero `GET /parking-spaces/:id`: quién lo ocupa ahora y la
 * reserva vigente o la próxima vienen ya dentro, sin peticiones extra.
 */
export interface SpaceDetailData {
  id: string;
  code: string;
  status: SpaceStatus;
  type: SpaceType;
  priority: number;
  isAccessible: boolean;
  isCovered: boolean;
  zone: {
    id: string;
    code: string;
    name: string;
    floor: number;
    allowedCategories: UserCategory[];
    parkingLot: { id: string; code: string; name: string };
  };
  activeSession: {
    id: string;
    checkInAt: string;
    slot: number;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      category: UserCategory;
    };
  } | null;
  reservation: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    reservationType: string;
    vehiclePlate: string | null;
    visitor: { firstName: string; lastName: string } | null;
    user: { firstName: string; lastName: string } | null;
  } | null;
}

/** Carga el detalle del puesto seleccionado. `null` cuando no hay ninguno. */
export function useSpaceDetail(spaceId: string | null) {
  const [cargado, setCargado] = useState<SpaceDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // No toca el estado: igual que en useCrud, el efecto no puede llamar a
  // setState antes del primer await sin encadenar renders de más.
  const fetchDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<{ data: SpaceDetailData }>(
      `/parking-spaces/${id}`,
      { signal },
    );
    return data.data;
  }, []);

  useEffect(() => {
    if (!spaceId) return;

    // Al pinchar rápido por el mapa se encadenan peticiones; sin abortar, la
    // respuesta lenta de un puesto anterior pisaría la del actual.
    const controller = new AbortController();

    void fetchDetail(spaceId, controller.signal)
      .then(setCargado)
      .catch(() => {
        // Un detalle que no carga no debe romper el mapa: el panel se queda
        // con los datos que ya trae el plano.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [spaceId, fetchDetail]);

  const reload = useCallback(() => {
    if (!spaceId) return;
    setLoading(true);
    void fetchDetail(spaceId)
      .then(setCargado)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [spaceId, fetchDetail]);

  // Se compara el id en vez de limpiar el estado al cambiar de puesto: así el
  // panel nunca enseña la ocupación del puesto anterior mientras carga el
  // nuevo, que es justo el dato que no puede salir equivocado.
  const detail = cargado && cargado.id === spaceId ? cargado : null;

  return { detail, loading, reload };
}
