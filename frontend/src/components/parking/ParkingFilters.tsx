'use client';

import { SelectField } from '@/components/admin-ui';
import { STATUS_META, TYPE_LABELS, type SpaceType } from '@/lib/parking';
import { EMPTY_FILTERS, type MapFilters, type MapZone } from './use-parking-map';

/** Atajos de la pantalla 03: visitantes, profesores, VIP. */
const TYPE_SHORTCUTS: SpaceType[] = ['VISITOR', 'PROFESSOR', 'VIP'];

interface Props {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  zones: MapZone[];
  /** El filtro de estado solo tiene sentido para el ADMIN (pantalla A02). */
  showStatus?: boolean;
  onReload?: () => void;
  loading?: boolean;
}

export function ParkingFilters({
  filters,
  onChange,
  zones,
  showStatus = false,
  onReload,
  loading,
}: Props) {
  const set = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const isDirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Filtros</h2>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={() => onChange(EMPTY_FILTERS)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Limpiar
            </button>
          )}
          {onReload && (
            <button
              onClick={onReload}
              disabled={loading}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          )}
        </div>
      </div>

      <SelectField
        id="map-zone"
        label="Zona"
        value={filters.zoneId}
        onChange={(v) => set('zoneId', v)}
        options={zones.map((z) => ({
          value: z.id,
          label: `${z.code} — ${z.name}`,
        }))}
        placeholder="Todas las zonas"
      />

      {showStatus && (
        <SelectField
          id="map-status"
          label="Estado"
          value={filters.status}
          onChange={(v) => set('status', v as MapFilters['status'])}
          options={Object.entries(STATUS_META).map(([value, meta]) => ({
            value,
            label: `${meta.icon} ${meta.label}`,
          }))}
          placeholder="Todos los estados"
        />
      )}

      <SelectField
        id="map-type"
        label="Tipo de puesto"
        value={filters.type}
        onChange={(v) => set('type', v as MapFilters['type'])}
        options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        placeholder="Todos los tipos"
      />

      <fieldset>
        <legend className="text-sm font-medium text-slate-300 mb-2">
          Mostrar solo
        </legend>
        <div className="space-y-2">
          <Check
            id="only-available"
            label="Disponibles"
            checked={filters.onlyAvailable}
            onChange={(v) => set('onlyAvailable', v)}
          />
          <Check
            id="only-covered"
            label="Cubiertos"
            checked={filters.onlyCovered}
            onChange={(v) => set('onlyCovered', v)}
          />
          <Check
            id="only-accessible"
            label="Accesibles"
            checked={filters.onlyAccessible}
            onChange={(v) => set('onlyAccessible', v)}
          />
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Acceso rápido</p>
        <div className="flex flex-wrap gap-2">
          {TYPE_SHORTCUTS.map((type) => {
            const active = filters.type === type;
            return (
              <button
                key={type}
                onClick={() => set('type', active ? '' : type)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-500"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}
