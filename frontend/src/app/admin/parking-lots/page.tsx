'use client';

import { useState } from 'react';
import { useCrud } from '@/lib/use-crud';
import {
  ActiveToggle,
  Alert,
  Field,
  StatusBadge,
} from '@/components/admin-ui';

interface ParkingLot {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  isActive: boolean;
  _count?: { zones: number };
}

const EMPTY = { name: '', code: '', location: '' };

export default function AdminParkingLotsPage() {
  const { items, total, loading, error, create, patch, remove } =
    useCrud<ParkingLot>('/parking-lots');

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const err = await create({
      name: form.name,
      code: form.code.toUpperCase(),
      location: form.location || undefined,
    });
    setSaving(false);
    setFormError(err);
    if (!err) setForm(EMPTY);
  };

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Estacionamientos</h1>
        <p className="text-slate-400 mt-1">
          Estructura física del campus — {total}{' '}
          {total === 1 ? 'estacionamiento' : 'estacionamientos'}
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Nuevo estacionamiento</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            id="lot-name"
            label="Nombre"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            placeholder="Estacionamiento Principal"
            required
            minLength={3}
          />
          <Field
            id="lot-code"
            label="Código"
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="PRINCIPAL"
            required
            minLength={2}
            hint="Mayúsculas, números y guion. No se puede cambiar después."
          />
          <Field
            id="lot-location"
            label="Ubicación"
            value={form.location}
            onChange={(location) => setForm({ ...form, location })}
            placeholder="Av. Universidad, entrada principal"
          />
        </div>

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-lot"
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Crear estacionamiento'}
        </button>
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
            Todavía no hay estacionamientos registrados.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Estacionamientos registrados
              </caption>
              <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="text-left px-6 py-3">
                    Código
                  </th>
                  <th scope="col" className="text-left px-6 py-3">
                    Nombre
                  </th>
                  <th scope="col" className="text-left px-6 py-3">
                    Ubicación
                  </th>
                  <th scope="col" className="text-right px-6 py-3">
                    Zonas
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
                {items.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-6 py-4 font-mono text-blue-400">
                      {lot.code}
                    </td>
                    <td className="px-6 py-4 text-white">{lot.name}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {lot.location ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300">
                      {lot._count?.zones ?? 0}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge isActive={lot.isActive} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ActiveToggle
                        isActive={lot.isActive}
                        onDeactivate={() => void remove(lot.id)}
                        onReactivate={() =>
                          void patch(lot.id, { isActive: true })
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
