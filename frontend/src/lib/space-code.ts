/**
 * Normaliza lo que el estudiante teclea al código real del puesto.
 *
 * En el piso está pintado «A-050», pero nadie escribe el guion ni los ceros
 * en un teléfono con el carro en marcha. Se acepta a50, A50, a-50, A050… y
 * todo termina en A-050.
 *
 * Devuelve null si todavía no hay una letra y al menos un dígito: así el
 * formulario puede deshabilitar el botón sin inventarse un código.
 */
export function normalizeSpaceCode(entrada: string): string | null {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const zona = limpio.match(/^[A-Z]/)?.[0];
  const numero = limpio.slice(1).replace(/\D/g, '');

  if (!zona || numero.length === 0) return null;

  // Los códigos del campus son letra + tres dígitos (A-001 … J-100)
  return `${zona}-${numero.padStart(3, '0')}`;
}
