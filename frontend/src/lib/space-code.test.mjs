// Comprobación mínima: node src/lib/space-code.test.mjs
import assert from 'node:assert/strict';

// Copia de la función: este archivo corre con node a secas, sin TypeScript.
function normalizeSpaceCode(entrada) {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const zona = limpio.match(/^[A-Z]/)?.[0];
  const numero = limpio.slice(1).replace(/\D/g, '');
  if (!zona || numero.length === 0) return null;
  return `${zona}-${numero.padStart(3, '0')}`;
}

for (const entrada of ['a50', 'A50', 'a-50', 'A-050', 'a 50', 'A_50']) {
  assert.equal(normalizeSpaceCode(entrada), 'A-050', `falló con "${entrada}"`);
}

assert.equal(normalizeSpaceCode('j100'), 'J-100');
assert.equal(normalizeSpaceCode('B7'), 'B-007');

// Sin letra o sin número no hay código que buscar
for (const entrada of ['', 'A', '050', '   ', '-']) {
  assert.equal(normalizeSpaceCode(entrada), null, `debía ser null: "${entrada}"`);
}

console.log('✓ normalizeSpaceCode');
