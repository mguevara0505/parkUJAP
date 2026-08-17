#!/bin/sh
# ─────────────────────────────────────────────────────────
# UJAP Parking — Restauración de un respaldo
#
#   ./scripts/restore.sh backups/ujap-parking-20260817-030000.sql.gz
#
# BORRA los datos actuales y los sustituye por los del volcado.
# Pide confirmación escrita antes de tocar nada.
# ─────────────────────────────────────────────────────────
set -eu

cd "$(dirname "$0")/.."

FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "Uso: $0 <archivo.sql.gz>"
  echo
  echo "Respaldos disponibles:"
  ls -1t backups/ujap-parking-*.sql.gz 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "No existe: $FILE"
  exit 1
fi

if [ -f .env ]; then
  . ./.env
fi

: "${POSTGRES_USER:=ujap_user}"
: "${POSTGRES_DB:=ujap_parking_db}"

echo "Se va a REEMPLAZAR el contenido de ${POSTGRES_DB} por ${FILE}."
echo "Los datos actuales se pierden."
printf 'Escriba «restaurar» para continuar: '
read -r RESPUESTA

if [ "$RESPUESTA" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

# La API se para durante la restauración: si sigue escribiendo mientras el
# volcado hace DROP de las tablas, el resultado es impredecible.
echo "Parando la API…"
docker compose -f docker-compose.prod.yml stop api

echo "Restaurando…"
gzip -dc "$FILE" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

echo "Arrancando la API…"
docker compose -f docker-compose.prod.yml start api

echo "✓ Restaurado desde ${FILE}"
