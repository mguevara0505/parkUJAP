'use client';

import { useEffect, useRef } from 'react';

/**
 * Lee un parámetro de la URL una sola vez, para sembrar el estado inicial.
 *
 * Sirve para llegar desde el mapa a «Reservar» o «Editar» con el código del
 * puesto ya puesto (pantalla A03).
 *
 * Se hace en un efecto y no al construir el estado a propósito: en el
 * servidor no existe `window`, y leerlo durante el render daría un HTML
 * distinto al del cliente. `useSearchParams` de Next haría lo mismo pero
 * obliga a envolver la página en Suspense; esto son cuatro líneas.
 */
export function useQueryParam(
  name: string,
  onValue: (value: string) => void,
): void {
  const aplicado = useRef(false);

  useEffect(() => {
    // Solo al montar. Volver a aplicarlo pisaría lo que el usuario escriba.
    if (aplicado.current) return;
    aplicado.current = true;

    const value = new URLSearchParams(window.location.search).get(name);
    if (value) onValue(value);
    // `onValue` es una función nueva en cada render; incluirla en las
    // dependencias reejecutaría el efecto sin necesidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}
