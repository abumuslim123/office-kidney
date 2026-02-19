#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

BACKUP_DIR="${DB_BACKUP_DIR:-/backups}"
RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
TARGET_FILE="${BACKUP_DIR}/${PGDATABASE}-${TIMESTAMP}.sql.gz"
TMP_FILE="${TARGET_FILE}.tmp"

mkdir -p "${BACKUP_DIR}"

pg_dump --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" --dbname="${PGDATABASE}" \
  --no-owner --no-privileges --format=plain | gzip -9 > "${TMP_FILE}"
mv "${TMP_FILE}" "${TARGET_FILE}"
echo "[db-backup] Created ${TARGET_FILE}"

if [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
  find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -print -delete || true
fi
