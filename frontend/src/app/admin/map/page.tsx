'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Alert } from '@/components/admin-ui';
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
    } catch {
      setActionError('No se pudo cambiar el estado del puesto');
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
          >
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
