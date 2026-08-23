'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { STATUS_META, type SpaceStatus } from '@/lib/parking';
import { normalizeSpaceCode } from '@/lib/space-code';
import { errorMessage } from '@/lib/sessions';

interface PuestoEncontrado {
  id: string;
  code: string;
  status: SpaceStatus;
  zone: { code: string; name: string };
}

interface Props {
  /** Se llama tras registrar, para refrescar la sesión activa. */
  onRegistrado: () => void | Promise<void>;
}

/**
 * Registrar el estacionamiento escribiendo el código del puesto.
 *
 * Es el camino corto de la pantalla 04. El estudiante que acaba de aparcar ya
 * sabe dónde está: lo tiene pintado delante. Buscar ese mismo puesto entre
 * ~1.000 rectángulos de un plano, en un teléfono, es el paso más lento de toda
 * la aplicación. El mapa sigue ahí para quien todavía no sabe dónde dejar el
 * carro; esto es para quien ya lo dejó.
 *
 * Primero se busca el puesto y se enseña lo que se encontró, y solo después se
 * registra: la sección 20 pide confirmación, y así un dedo torpe no ocupa el
 * puesto del vecino.
 */
export function QuickCheckIn({ onRegistrado }: Props) {
  const [texto, setTexto] = useState('');
  const [puesto, setPuesto] = useState<PuestoEncontrado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codigo = normalizeSpaceCode(texto);

  const reiniciar = () => {
    setPuesto(null);
    setError(null);
  };

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo) return;

    setBuscando(true);
    reiniciar();

    try {
      const { data } = await api.get<{ data: PuestoEncontrado }>(
        `/parking-spaces/code/${codigo}`,
      );
      setPuesto(data.data);
    } catch {
      // El 404 es el caso normal aquí: se tecleó un código que no existe
      setError(`No existe el puesto ${codigo}. Revise el número pintado en el piso.`);
    } finally {
      setBuscando(false);
    }
  };

  const registrar = async () => {
    if (!puesto) return;
    setGuardando(true);
    setError(null);

    try {
      await api.post('/parking-sessions/check-in', {
        parkingSpaceId: puesto.id,
      });
      setTexto('');
      setPuesto(null);
      await onRegistrado();
    } catch (err) {
      // El mensaje del backend ya es explicativo y nombra las zonas que sí
      // corresponden cuando rechaza por categoría; no hay que reconstruirlo.
      setError(errorMessage(err, 'No se pudo registrar el estacionamiento'));
      setPuesto(null);
    } finally {
      setGuardando(false);
    }
  };

  const disponible = puesto?.status === 'AVAILABLE';

  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/20 rounded-2xl p-5 sm:p-6">
      <h2 className="text-white font-bold text-lg">¿Ya se estacionó?</h2>
      <p className="text-slate-400 text-sm mt-0.5 mb-4">
        Escriba el código pintado en el piso
      </p>

      <form onSubmit={(e) => void buscar(e)} className="flex gap-2">
        <label htmlFor="codigo-puesto" className="sr-only">
          Código del puesto
        </label>
        <input
          id="codigo-puesto"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            reiniciar();
          }}
          placeholder="A-050"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          className="flex-1 min-w-0 px-4 py-4 rounded-xl bg-slate-950/60 border border-white/15 text-white text-2xl font-mono font-bold tracking-widest text-center placeholder-slate-600 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        />
        <button
          type="submit"
          disabled={!codigo || buscando}
          className="px-5 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors shrink-0"
        >
          {buscando ? '…' : 'Buscar'}
        </button>
      </form>

      {/* Lo que se tecleó, ya normalizado: «a50» encuentra A-050 */}
      {codigo && codigo !== texto.toUpperCase() && !puesto && !error && (
        <p className="mt-2 text-xs text-slate-500">
          Se buscará <span className="font-mono text-slate-300">{codigo}</span>
        </p>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {puesto && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/50 border border-white/10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-white text-2xl font-mono font-bold">
                {puesto.code}
              </p>
              <p className="text-slate-400 text-sm">
                {puesto.zone.code} — {puesto.zone.name}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${STATUS_META[puesto.status].className}`}
            >
              {STATUS_META[puesto.status].icon}{' '}
              {STATUS_META[puesto.status].label}
            </span>
          </div>

          {disponible ? (
            <button
              id="btn-registrar-codigo"
              onClick={() => void registrar()}
              disabled={guardando}
              className="w-full px-4 py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-bold tracking-wide transition-colors"
            >
              {guardando ? 'Registrando…' : 'ME ESTACIONÉ AQUÍ'}
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              Este puesto está {STATUS_META[puesto.status].label.toLowerCase()}.{' '}
              <Link
                href="/dashboard/map"
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Ver puestos libres
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
