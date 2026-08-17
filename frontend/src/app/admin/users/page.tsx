'use client';

import { useMemo, useState } from 'react';
import { useCrud } from '@/lib/use-crud';
import { Alert, Field, SelectField } from '@/components/admin-ui';
import {
  CATEGORY_LABELS,
  CATEGORY_SINGULAR,
  type UserCategory,
} from '@/lib/parking';

type UserRole = 'USER' | 'ADMIN';
type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  category: UserCategory;
  status: UserStatus;
  universityId: string | null;
  lastLoginAt: string | null;
}

const PAGE_SIZE = 20;
const CATEGORIES: UserCategory[] = ['STUDENT', 'PROFESSOR', 'STAFF'];

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: '✓ Activo',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  INACTIVE: {
    label: '○ Inactivo',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  SUSPENDED: {
    label: '⚠ Suspendido',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
};

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  universityId: '',
  category: 'STUDENT' as UserCategory,
  role: 'USER' as UserRole,
};

/** Pantalla A07 — Usuarios (CU-012). */
export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filters.search) params.set('search', filters.search);
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    return `?${params.toString()}`;
  }, [filters, page]);

  const { items, total, loading, error, create, patch, remove } =
    useCrud<AdminUser>('/users', query);

  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const err = await create({
      ...form,
      universityId: form.universityId || undefined,
    });
    setSaving(false);
    setFormError(err);
    if (!err) setForm(EMPTY);
  };

  const update = async (id: string, body: Record<string, unknown>) => {
    setRowError(await patch(id, body));
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="text-slate-400 mt-1">
          {total.toLocaleString('es-VE')}{' '}
          {total === 1 ? 'usuario registrado' : 'usuarios registrados'}
        </p>
      </header>

      {/* Alta */}
      <form
        onSubmit={submit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">Nuevo usuario</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            id="usr-first"
            label="Nombre"
            value={form.firstName}
            onChange={(firstName) => setForm({ ...form, firstName })}
            placeholder="Juan"
            required
            minLength={2}
          />
          <Field
            id="usr-last"
            label="Apellido"
            value={form.lastName}
            onChange={(lastName) => setForm({ ...form, lastName })}
            placeholder="Pérez"
            required
            minLength={2}
          />
          <Field
            id="usr-email"
            label="Correo"
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
            placeholder="juan.perez@ujap.edu.ve"
            required
          />
          <Field
            id="usr-password"
            label="Contraseña"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
            placeholder="Mín. 8 caracteres y un número"
            required
            minLength={8}
          />
          <Field
            id="usr-uid"
            label="Cédula universitaria"
            value={form.universityId}
            onChange={(universityId) => setForm({ ...form, universityId })}
            placeholder="2024-011"
          />
          <SelectField
            id="usr-category"
            label="Categoría"
            value={form.category}
            onChange={(v) =>
              setForm({ ...form, category: v as UserCategory })
            }
            options={CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORY_SINGULAR[c],
            }))}
            required
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          La categoría decide en qué zonas puede estacionarse y cuántos puestos
          puede tener a la vez.
        </p>

        {formError && (
          <div className="mt-4">
            <Alert>{formError}</Alert>
          </div>
        )}

        <button
          id="btn-create-user"
          type="submit"
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all"
        >
          {saving ? 'Guardando…' : 'Crear usuario'}
        </button>
      </form>

      {/* Filtros */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="usr-search"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Buscar
            </label>
            <input
              id="usr-search"
              type="search"
              value={filters.search}
              placeholder="Nombre, correo o cédula universitaria"
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <SelectField
            id="usr-filter-role"
            label="Rol"
            value={filters.role}
            onChange={(v) => setFilter('role', v)}
            options={[
              { value: 'USER', label: 'Usuario' },
              { value: 'ADMIN', label: 'Administrador' },
            ]}
            placeholder="Todos"
          />
          <SelectField
            id="usr-filter-status"
            label="Estado"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            placeholder="Todos"
          />
        </div>
      </div>

      {rowError && (
        <div className="mb-6">
          <Alert>{rowError}</Alert>
        </div>
      )}

      {/* Listado */}
      <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading && <p className="p-6 text-slate-400 text-sm">Cargando…</p>}

        {error && (
          <div className="p-6">
            <Alert>{error}</Alert>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="p-6 text-slate-400 text-sm">
            No hay usuarios que coincidan con los filtros.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Usuarios registrados</caption>
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3">Usuario</th>
                    <th scope="col" className="text-left px-4 py-3">Cédula univ.</th>
                    <th scope="col" className="text-left px-4 py-3">Categoría</th>
                    <th scope="col" className="text-left px-4 py-3">Rol</th>
                    <th scope="col" className="text-left px-4 py-3">Estado</th>
                    <th scope="col" className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="text-white">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-slate-500 text-xs">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {u.universityId ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {/* Cambiar la categoría cambia sus zonas al instante */}
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORIES.map((cat) => {
                            const on = u.category === cat;
                            return (
                              <button
                                key={cat}
                                onClick={() =>
                                  void update(u.id, { category: cat })
                                }
                                disabled={on}
                                aria-pressed={on}
                                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                  on
                                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                                    : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                                }`}
                              >
                                {CATEGORY_LABELS[cat]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            void update(u.id, {
                              role: u.role === 'ADMIN' ? 'USER' : 'ADMIN',
                            })
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          {u.role === 'ADMIN' ? '★ Administrador' : 'Usuario'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_META[u.status].className}`}
                        >
                          {STATUS_META[u.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => void remove(u.id)}
                            className="text-slate-400 hover:text-red-400 text-xs font-medium"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              void update(u.id, { status: 'ACTIVE' })
                            }
                            className="text-slate-400 hover:text-green-400 text-xs font-medium"
                          >
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Paginación"
                className="flex items-center justify-between px-4 py-3 border-t border-white/5"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
