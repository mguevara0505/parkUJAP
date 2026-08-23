'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Alert } from '@/components/admin-ui';
import { errorMessage } from '@/lib/sessions';
import { useSpaceDetail } from '@/lib/space-detail';
import { ParkingMap } from '@/components/parking/ParkingMap';
import { ParkingLegend } from '@/components/parking/ParkingLegend';
import { ParkingFilters } from '@/components/parking/ParkingFilters';
import { SpaceDetail } from '@/components/parking/SpaceDetail';
import { useParkingMap } from '@/components/parking/use-parking-map';
import type { MapSpace, SpaceStatus } from '@/lib/parking';

/** Pantalla A02 — mapa general con filtros y acciones administrativas. */
export default function AdminMapPage() {
  const {
    spaces,
    zones,
    bounds,
    counts,
    total,
    loading,
    error,
    filters,
    setFilters,
    reload,
    patchSpace,
  } = useParkingMap();

  const [selected, setSelected] = useState<MapSpace | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { detail, reload: reloadDetail } = useSpaceDetail(selected?.id ?? null);

  const zoneOf = (space: MapSpace) => zones.find((z) => z.id === space.zoneId);

  const changeStatus = async (status: SpaceStatus) => {
    if (!selected) return;
    setActionError(null);
    try {
      await api.patch(`/parking-spaces/${selected.id}`, { status });
      // Solo se refresca ese puesto en memoria: recargar el plano completo por
      // un cambio de estado sería descargar ~260 KB de nuevo
      patchSpace(selected.id, { status });
      setSelected({ ...selected, status });
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo cambiar el estado del puesto'));
    }
  };

  /**
   * Liberar administrativamente (pantalla A03): cierra la sesión de otra
   * persona cuando se fue sin registrar la salida.
   *
   * El estado que queda no lo decide esta pantalla: el check-out aplica la
   * RN-015 y puede dejar el puesto en mantenimiento o reservado si hay algo
   * inmediatamente después. Por eso se lee el estado de la respuesta en vez
   * de suponer AVAILABLE.
   */
  const forceCheckOut = async () => {
    if (!selected || !detail?.activeSession) return;

    const quien = `${detail.activeSession.user.firstName} ${detail.activeSession.user.lastName}`;
    const confirmado = window.confirm(
      `¿Liberar el puesto ${selected.code}?

Se cerrará la sesión de ${quien}. Quedará registrado en la auditoría.`,
    );
    if (!confirmado) return;

    setActionError(null);
    try {
      const { data } = await api.post<{ data: { parkingSpace: { status: SpaceStatus } } }>(
        `/parking-sessions/${detail.activeSession.id}/check-out`,
      );
      const nuevoEstado = data.data.parkingSpace.status;
      patchSpace(selected.id, { status: nuevoEstado });
      setSelected({ ...selected, status: nuevoEstado });
      reloadDetail();
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo liberar el puesto'));
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mapa de Puestos</h1>
        <p className="text-slate-400 mt-1">
          Estado de los {total.toLocaleString('es-VE')} puestos del campus
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Panel lateral */}
        <div className="xl:col-span-1 space-y-4">
          <ParkingFilters
            filters={filters}
            onChange={setFilters}
            zones={zones}
            showStatus
            onReload={() => void reload()}
            loading={loading}
          />
          <ParkingLegend counts={counts} total={total} />
          <SpaceDetail
            space={selected}
            zoneLabel={
              selected
                ? (() => {
                    const zone = zoneOf(selected);
                    return zone ? `${zone.code} — ${zone.name}` : undefined;
                  })()
                : undefined
            }
            onChangeStatus={(status) => void changeStatus(status)}
            detail={detail}
            onForceCheckOut={() => void forceCheckOut()}
          >
            {selected && (
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2">
                <Link
                  href={`/admin/reservations?code=${selected.code}`}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-center text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                >
                  Reservar
                </Link>
                <Link
                  href={`/admin/spaces?search=${selected.code}`}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-center text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Editar
                </Link>
              </div>
            )}

            {actionError && (
              <div className="mt-3">
                <Alert>{actionError}</Alert>
              </div>
            )}
          </SpaceDetail>
        </div>

        {/* Mapa */}
        <section className="xl:col-span-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading && spaces.length === 0 ? (
            <p className="p-8 text-slate-400 text-sm text-center">
              Cargando el plano…
            </p>
          ) : (
            <ParkingMap
              spaces={spaces}
              zones={zones}
              bounds={bounds}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          )}
        </section>
      </div>
    </div>
  );
}
