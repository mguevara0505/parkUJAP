'use client';

import { useMemo, useRef, useState } from 'react';
import {
  STATUS_META,
  TYPE_LABELS,
  zoneAudience,
  type MapSpace,
  type UserCategory,
} from '@/lib/parking';
import type { MapZone } from './use-parking-map';

/**
 * Por encima de este zoom se dibuja el código dentro de cada puesto.
 *
 * ponytail: cruzar el umbral crea 1.000 nodos <text> de golpe y cuesta ~173 ms
 * medidos con 1.000 puestos; los demás pasos de zoom cuestan 2-6 ms. Es un
 * tirón único y aceptable. Si molesta, la salida es renderizar los textos
 * siempre y ocultarlos con una clase CSS en la raíz del SVG, a cambio de ~1.000
 * nodos permanentes en el DOM.
 */
const LABEL_THRESHOLD = 0.55;
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 1.35;

interface Props {
  spaces: MapSpace[];
  zones: MapZone[];
  bounds: { width: number; height: number };
  selectedId?: string | null;
  onSelect: (space: MapSpace) => void;
  /**
   * Si se indica, las zonas que no admiten esta categoría se atenúan.
   * El administrador no la pasa: necesita ver el campus entero por igual.
   */
  highlightFor?: UserCategory;
}

export function ParkingMap({
  spaces,
  zones,
  bounds,
  selectedId,
  onSelect,
  highlightFor,
}: Props) {
  // Zoom inicial: que el plano completo entre a lo ancho de un panel típico
  const [zoom, setZoom] = useState(() =>
    bounds.width > 0 ? Math.min(1, 1000 / bounds.width) : 0.35,
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const showLabels = zoom >= LABEL_THRESHOLD;

  /**
   * Recuadro de cada zona, deducido de las coordenadas de sus puestos: el
   * backend no almacena geometría de zona, y calcularla aquí evita un campo
   * más que podría quedar desincronizado.
   */
  const zoneBoxes = useMemo(() => {
    const boxes = new Map<
      string,
      { minX: number; minY: number; maxX: number; maxY: number }
    >();

    for (const s of spaces) {
      const box = boxes.get(s.zoneId);
      if (!box) {
        boxes.set(s.zoneId, {
          minX: s.positionX,
          minY: s.positionY,
          maxX: s.positionX + s.width,
          maxY: s.positionY + s.height,
        });
        continue;
      }
      box.minX = Math.min(box.minX, s.positionX);
      box.minY = Math.min(box.minY, s.positionY);
      box.maxX = Math.max(box.maxX, s.positionX + s.width);
      box.maxY = Math.max(box.maxY, s.positionY + s.height);
    }

    return zones
      .map((zone) => ({ zone, box: boxes.get(zone.id) }))
      .filter((z): z is { zone: MapZone; box: NonNullable<typeof z.box> } =>
        Boolean(z.box),
      );
  }, [spaces, zones]);

  /**
   * Capa de puestos. Memoizada sobre `spaces` y `showLabels` únicamente: la
   * selección se dibuja aparte para que elegir un puesto no vuelva a renderizar
   * los ~1.000 rectángulos (sección 59, riesgo 2).
   */
  /** Zonas donde esta persona puede estacionarse por su cuenta. */
  const myZoneIds = useMemo(() => {
    if (!highlightFor) return null;
    return new Set(
      zones
        .filter((z) => z.allowedCategories.includes(highlightFor))
        .map((z) => z.id),
    );
  }, [zones, highlightFor]);

  const spaceLayer = useMemo(
    () =>
      spaces.map((s) => {
        const meta = STATUS_META[s.status];
        // Atenuar lo que no le corresponde guía la vista sin ocultar el campus
        const mine = !myZoneIds || myZoneIds.has(s.zoneId);

        return (
          <g key={s.id}>
            <rect
              data-space-id={s.id}
              x={s.positionX}
              y={s.positionY}
              width={s.width}
              height={s.height}
              rx={5}
              fill={meta.fill}
              fillOpacity={mine ? 0.85 : 0.18}
              stroke="#0f172a"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
            >
              {/* Tooltip nativo del SVG: sin coste de render (sección 18) */}
              <title>
                {[
                  s.code,
                  meta.label,
                  TYPE_LABELS[s.type],
                  // El tipo ACCESSIBLE ya lo dice: no repetirlo
                  s.isAccessible && s.type !== 'ACCESSIBLE' ? 'Accesible' : null,
                  s.isCovered ? 'Cubierto' : null,
                  mine ? null : 'No corresponde a su categoría',
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </title>
            </rect>

            {showLabels && (
              <text
                x={s.positionX + s.width / 2}
                y={s.positionY + s.height / 2 + 5}
                textAnchor="middle"
                fontSize={s.width < 40 ? 11 : 14}
                fill="#0f172a"
                fontWeight={600}
                pointerEvents="none"
              >
                {s.code}
              </text>
            )}
          </g>
        );
      }),
    [spaces, showLabels, myZoneIds],
  );

  const selected = selectedId
    ? spaces.find((s) => s.id === selectedId)
    : undefined;
  const focused = spaces[focusIndex];

  // Delegación: un solo listener en la raíz en lugar de 1.000 closures
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const id = (e.target as SVGElement).dataset?.spaceId;
    if (!id) return;
    const index = spaces.findIndex((s) => s.id === id);
    if (index >= 0) {
      setFocusIndex(index);
      onSelect(spaces[index]);
    }
  };

  /**
   * Navegación por teclado (sección 47). Un único punto de tabulación en lugar
   * de 1.000: las flechas mueven el cursor sobre los puestos ordenados por
   * código y Enter selecciona.
   */
  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const jump = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 20, ArrowUp: -20 }[
      e.key
    ];

    if (jump !== undefined) {
      e.preventDefault();
      setFocusIndex((i) => Math.min(spaces.length - 1, Math.max(0, i + jump)));
      return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && focused) {
      e.preventDefault();
      onSelect(focused);
    }
  };

  if (spaces.length === 0) {
    return (
      <p className="p-8 text-slate-400 text-sm text-center">
        Ningún puesto coincide con los filtros seleccionados.
      </p>
    );
  }

  return (
    <div>
      {/* Controles de zoom */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <button
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Alejar"
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg leading-none disabled:opacity-40"
        >
          −
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Acercar"
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg leading-none disabled:opacity-40"
        >
          +
        </button>
        <span className="text-xs text-slate-400 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {spaces.length.toLocaleString('es-VE')} puestos · flechas para
          recorrer, Enter para seleccionar
        </span>
      </div>

      {/* El scroll nativo hace de paneo: nada que implementar (sección 47) */}
      <div className="overflow-auto max-h-[70vh] bg-slate-950/60">
        <svg
          ref={svgRef}
          role="application"
          aria-label="Mapa de puestos de estacionamiento"
          tabIndex={0}
          width={bounds.width * zoom}
          height={bounds.height * zoom}
          viewBox={`0 0 ${bounds.width} ${bounds.height}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        >
          {/* Fondo y etiqueta de cada zona */}
          {zoneBoxes.map(({ zone, box }) => {
            const mine = !myZoneIds || myZoneIds.has(zone.id);

            return (
              <g key={zone.id}>
                <rect
                  x={box.minX - 24}
                  y={box.minY - 56}
                  width={box.maxX - box.minX + 48}
                  height={box.maxY - box.minY + 80}
                  rx={16}
                  fill="#ffffff"
                  fillOpacity={mine ? 0.04 : 0.015}
                  stroke={mine && myZoneIds ? '#60a5fa' : '#ffffff'}
                  strokeOpacity={mine && myZoneIds ? 0.5 : 0.12}
                  strokeWidth={mine && myZoneIds ? 3 : 2}
                />
                <text
                  x={box.minX - 8}
                  y={box.minY - 22}
                  fontSize={34}
                  fill={mine ? '#cbd5e1' : '#64748b'}
                  fontWeight={700}
                >
                  {zone.name}
                  {/* Quién puede usarla, sin depender solo del atenuado */}
                  {` · ${zoneAudience(zone.allowedCategories)}`}
                  {!zone.isActive && ' (inactiva)'}
                </text>
              </g>
            );
          })}

          {spaceLayer}

          {/* Cursor de teclado */}
          {focused && (
            <rect
              x={focused.positionX - 3}
              y={focused.positionY - 3}
              width={focused.width + 6}
              height={focused.height + 6}
              rx={7}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={3}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}

          {/* Puesto seleccionado */}
          {selected && (
            <rect
              x={selected.positionX - 5}
              y={selected.positionY - 5}
              width={selected.width + 10}
              height={selected.height + 10}
              rx={9}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={5}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
