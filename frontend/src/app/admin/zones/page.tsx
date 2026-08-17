'use client';

import { useState } from 'react';
import { useCrud } from '@/lib/use-crud';
import {
  ActiveToggle,
  Alert,
  Field,
  SelectField,
  StatusBadge,
} from '@/components/admin-ui';

interface ParkingLotOption {
  id: string;
  name: string;
  code: string;
}

interface ParkingZone {
  id: string;
  name: string;
  code: string;
  floor: number | null;
  sortOrder: number;
  isActive: boolean;
  parkingLot?: { id: string; name: string; code: string };
  _count?: { spaces: number };
}

const EMPTY = { parkingLotId: '', name: '', code: '', floor: '1' };

export default function AdminZonesPage() {
  // Solo estacionamientos activos: crear una zona en uno cerrado no tiene sentido
  const { items: lots } = useCrud<ParkingLotOption>(
    '/parking-lots',
    '?isActive=true&limit=100',
  );
  const { items, total, loading, error, create, patch, remove } =
    useCrud<ParkingZone>('/parking-zones', '?limit=100');

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const err = await create({
      parkingLotId: form.parkingLotId,
      name: form.name,
      code: form.code.toUpperCase(),
      floor: Number(form.floor) || 1,
      sortOrder: total + 1,
    });
    setSaving(false);
    setFormError(err);
    if (!err) setForm({ ...EMPTY, parkingLotId: form.parkingLotId });
  };

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Zonas</h1>
        <p className="text-slate-400 mt-1">
          Divisiones de cada estacionamiento — {total}{' '}
          {total === 1 ? 'zona' : 'zonas'}
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Nueva zona</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SelectField
            id="zone-lot"
            label="Estacionamiento"
            value={form.parkingLotId}
            onChange={(parkingLotId) => setForm({ ...form, parkingLotId })}
            options={lots.map((lot) => ({
              value: lot.id,
              label: `${lot.code} — ${lot.name}`,
            }))}
            required
          />
          <Field
            id="zone-name"
            label="Nombre"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            placeholder="Zona K"
            required
            minLength={2}
          />
          <Field
            id="zone-code"
            label="Código"
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="K"
            required
            hint="Prefija los puestos: K-001, K-002…"
          />
          <Field
            id="zone-floor"
            label="Piso"
            type="number"
            value={form.floor}
            onChange={(floor) => setForm({ ...form, floor })}
            placeholder="1"
          />
        </div>

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-zone"
          type="submit"
          disabled={saving || lots.length === 0}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Crear zona'}
        </button>

        {lots.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Primero registre un estacionamiento activo.
          </p>
        )}
      </form>

      <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

        {error && (
          <div className="p-6">
            <Alert>{error}</Alert>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="p-6 text-slate-400 text-sm">
            Todavía no hay zonas registradas.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Zonas registradas</caption>
              <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="text-left px-6 py-3">
                    Código
                  </th>
                  <th scope="col" className="text-left px-6 py-3">
                    Nombre
                  </th>
                  <th scope="col" className="text-left px-6 py-3">
                    Estacionamiento
                  </th>
                  <th scope="col" className="text-right px-6 py-3">
                    Piso
                  </th>
                  <th scope="col" className="text-right px-6 py-3">
                    Puestos
                  </th>
                  <th scope="col" className="text-left px-6 py-3">
                    Estado
                  </th>
                  <th scope="col" className="text-right px-6 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((zone) => (
                  <tr key={zone.id}>
                    <td className="px-6 py-4 font-mono text-blue-400">
                      {zone.code}
                    </td>
                    <td className="px-6 py-4 text-white">{zone.name}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {zone.parkingLot?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300">
                      {zone.floor ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300">
                      {zone._count?.spaces ?? 0}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge isActive={zone.isActive} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ActiveToggle
                        isActive={zone.isActive}
                        onDeactivate={() => void remove(zone.id)}
                        onReactivate={() =>
                          void patch(zone.id, { isActive: true })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
