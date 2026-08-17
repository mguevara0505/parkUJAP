#!/bin/sh
# ─────────────────────────────────────────────────────────
# UJAP Parking — Respaldo de la base de datos
#
#   ./scripts/backup.sh
#
# Desde cron, todos los días a las 3 de la madrugada:
#   0 3 * * * cd /opt/ujap-parking && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Un respaldo que nadie ha restaurado nunca no es un respaldo. Ver
# `restore.sh` y la sección de recuperación en DESPLIEGUE.md.
# ─────────────────────────────────────────────────────────
set -eu

cd "$(dirname "$0")/.."

# El .env de producción trae POSTGRES_USER / POSTGRES_DB
if [ -f .env ]; then
  . ./.env
fi

: "${POSTGRES_USER:=ujap_user}"
: "${POSTGRES_DB:=ujap_parking_db}"
: "${BACKUP_KEEP_DAYS:=14}"

mkdir -p backups

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="backups/ujap-parking-${STAMP}.sql.gz"

echo "[$(date +'%F %T')] Respaldando ${POSTGRES_DB}…"

# --clean --if-exists: el volcado se puede restaurar sobre una base que ya
# tiene datos sin borrarla a mano antes.
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "$FILE"

# pg_dump puede fallar a mitad y dejar un .gz pequeño pero válido. Descomprimir
# y buscar la marca de cierre es lo único que distingue un volcado completo de
# uno truncado.
if ! gzip -dc "$FILE" | tail -5 | grep -q "PostgreSQL database dump complete"; then
  echo "  ✗ El volcado está incompleto. Se conserva como ${FILE}.roto para revisarlo."
  mv "$FILE" "${FILE}.roto"
  exit 1
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "  ✓ ${FILE} (${SIZE})"

# Rotación: se borran los volcados correctos viejos. Los .roto se quedan.
find backups -name 'ujap-parking-*.sql.gz' -mtime "+${BACKUP_KEEP_DAYS}" -print -delete

echo "[$(date +'%F %T')] Listo."
