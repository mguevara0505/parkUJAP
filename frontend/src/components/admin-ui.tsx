'use client';

/** Controles compartidos por las pantallas administrativas. */

export function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  minLength,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  type?: 'text' | 'number';
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-300 mb-1.5"
      >
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  placeholder = 'Seleccione…',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-300 mb-1.5"
      >
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 hover:border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** No depende solo del color: icono + texto (secciones 18 y 47). */
export function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      ✓ Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
      ○ Inactivo
    </span>
  );
}

/** Pantalla puente mientras zustand rehidrata la sesión desde localStorage. */
export function SessionLoading() {
  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-4 animate-pulse">
          <span className="text-2xl">🅿️</span>
        </div>
        <p className="text-slate-400 text-sm">Cargando sesión…</p>
      </div>
    </div>
  );
}

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3"
    >
      ⚠️ {children}
    </p>
  );
}

export function ActiveToggle({
  isActive,
  onDeactivate,
  onReactivate,
}: {
  isActive: boolean;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  return isActive ? (
    <button
      onClick={onDeactivate}
      className="text-slate-400 hover:text-red-400 text-xs font-medium transition-colors"
    >
      Desactivar
    </button>
  ) : (
    <button
      onClick={onReactivate}
      className="text-slate-400 hover:text-green-400 text-xs font-medium transition-colors"
    >
      Reactivar
    </button>
  );
}
