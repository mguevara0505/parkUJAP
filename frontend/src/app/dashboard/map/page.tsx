'use client';

import { useState } from 'react';
import { Alert } from '@/components/admin-ui';
import { ParkingMap } from '@/components/parking/ParkingMap';
import { ParkingLegend } from '@/components/parking/ParkingLegend';
import { ParkingFilters } from '@/components/parking/ParkingFilters';
import { SpaceDetail } from '@/components/parking/SpaceDetail';
import { useParkingMap } from '@/components/parking/use-parking-map';
import type { MapSpace } from '@/lib/parking';

/** Pantalla 03 — mapa de estacionamiento para el usuario universitario. */
export default function UserMapPage() {
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
  } = useParkingMap();

  const [selected, setSelected] = useState<MapSpace | null>(null);

  const available = counts.AVAILABLE ?? 0;
  const zone = selected
    ? zones.find((z) => z.id === selected.zoneId)
    : undefined;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mapa de Puestos</h1>
        <p className="text-slate-400 mt-1">
          {available.toLocaleString('es-VE')} de{' '}
          {total.toLocaleString('es-VE')} puestos disponibles ahora
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden order-2 lg:order-1">
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

        <div className="space-y-4 order-1 lg:order-2">
          <ParkingFilters
            filters={filters}
            onChange={setFilters}
            zones={zones}
            onReload={() => void reload()}
            loading={loading}
          />

          <SpaceDetail
            space={selected}
            zoneLabel={zone ? `${zone.code} — ${zone.name}` : undefined}
            emptyHint="Toque un puesto del mapa para ver sus datos."
          >
            {selected && (
              <p className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-500">
                El registro de ocupación (&quot;Me estacioné aquí&quot;) llega en
                el Sprint 5.
              </p>
            )}
          </SpaceDetail>

          <ParkingLegend counts={counts} total={total} />
        </div>
      </div>
    </div>
  );
}
