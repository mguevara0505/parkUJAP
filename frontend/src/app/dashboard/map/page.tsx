'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Alert } from '@/components/admin-ui';
import { ParkingMap } from '@/components/parking/ParkingMap';
import { ParkingLegend } from '@/components/parking/ParkingLegend';
import { ParkingFilters } from '@/components/parking/ParkingFilters';
import { SpaceDetail } from '@/components/parking/SpaceDetail';
import { useParkingMap } from '@/components/parking/use-parking-map';
import { errorMessage, useActiveSession } from '@/lib/sessions';
import { useAuthStore } from '@/store/auth.store';
import {
  CATEGORY_SINGULAR,
  zoneAudience,
  type MapSpace,
} from '@/lib/parking';

/** Pantallas 03 y 04 — mapa y registro de ocupación. */
export default function UserMapPage() {
  const router = useRouter();
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

  const { session, reload: reloadSession } = useActiveSession();
  const { user } = useAuthStore();

  const [selected, setSelected] = useState<MapSpace | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const available = counts.AVAILABLE ?? 0;
  const zone = selected
    ? zones.find((z) => z.id === selected.zoneId)
    : undefined;

  const category = user?.category;
  const myZones = category
    ? zones.filter((z) => z.allowedCategories.includes(category))
    : [];
  // El backend rechazaría el check-in igualmente; aquí solo se evita el intento
  const zoneIsMine = zone && category
    ? zone.allowedCategories.includes(category)
    : true;

  const select = (space: MapSpace) => {
    setSelected(space);
    setConfirming(false);
    setActionError(null);
  };

  const checkIn = async () => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);

    try {
      await api.post('/parking-sessions/check-in', {
        parkingSpaceId: selected.id,
      });
      // Refleja el cambio sin volver a descargar el plano completo
      patchSpace(selected.id, { status: 'OCCUPIED' });
      setSelected({ ...selected, status: 'OCCUPIED' });
      setConfirming(false);
      await reloadSession();
      router.push('/dashboard/my-parking');
    } catch (err) {
      setActionError(
        errorMessage(err, 'No se pudo registrar el estacionamiento'),
      );
      // El puesto pudo ocuparlo otro entre la carga y el clic: refrescar
      void reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mapa de Puestos</h1>
        <p className="text-slate-400 mt-1">
          {available.toLocaleString('es-VE')} de {total.toLocaleString('es-VE')}{' '}
          puestos disponibles ahora
        </p>
        {category && myZones.length > 0 && (
          <p className="text-sm text-blue-300 mt-2">
            Como {CATEGORY_SINGULAR[category].toLowerCase()}, puede estacionarse
            en{' '}
            <span className="font-semibold">
              {myZones.map((z) => z.code).join(', ')}
            </span>
            . Las demás zonas aparecen atenuadas.
          </p>
        )}
      </header>

      {session && (
        <div className="mb-6 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20">
          <span className="text-xl">🚗</span>
          <p className="text-sm text-slate-300 flex-1">
            Ya tiene registrado el puesto{' '}
            <span className="font-mono text-white">
              {session.parkingSpace.code}
            </span>
            . Libérelo antes de registrar otro.
          </p>
          <Link
            href="/dashboard/my-parking"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
          >
            Ver mi estacionamiento
          </Link>
        </div>
      )}

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
              onSelect={select}
              highlightFor={category}
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
            emptyHint="Toque un puesto del mapa para ver sus datos y registrarlo."
          >
            {selected && (
              <div className="mt-4 pt-4 border-t border-white/5">
                {actionError && <Alert>{actionError}</Alert>}

                {/* Pantalla 04 — registrar estacionamiento */}
                {!zoneIsMine ? (
                  <p className="text-xs text-slate-500">
                    {zone && zone.allowedCategories.length === 0
                      ? `La ${zone.name} es de reserva exclusiva: los puestos se asignan desde una reserva administrativa.`
                      : `Esta zona es para ${zone ? zoneAudience(zone.allowedCategories).toLowerCase() : 'otra categoría'}.`}
                    {myZones.length > 0 &&
                      ` Sus zonas son ${myZones.map((z) => z.code).join(', ')}.`}
                  </p>
                ) : selected.status !== 'AVAILABLE' ? (
                  <p className="text-xs text-slate-500">
                    Solo puede registrar puestos disponibles.
                  </p>
                ) : session ? (
                  <p className="text-xs text-slate-500">
                    Libere primero el puesto {session.parkingSpace.code}.
                  </p>
                ) : confirming ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-300">
                      ¿Confirma que se estacionó en{' '}
                      <span className="font-mono text-white">
                        {selected.code}
                      </span>
                      ?
                    </p>
                    <div className="flex gap-2">
                      <button
                        id="btn-confirmar-checkin"
                        onClick={() => void checkIn()}
                        disabled={saving}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white text-sm font-semibold transition-colors"
                      >
                        {saving ? 'Registrando…' : 'Sí, confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        disabled={saving}
                        className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id="btn-me-estacione-aqui"
                    onClick={() => setConfirming(true)}
                    className="w-full px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold tracking-wide transition-colors"
                  >
                    ME ESTACIONÉ AQUÍ
                  </button>
                )}
              </div>
            )}
          </SpaceDetail>

          <ParkingLegend counts={counts} total={total} />
        </div>
      </div>
    </div>
  );
}
