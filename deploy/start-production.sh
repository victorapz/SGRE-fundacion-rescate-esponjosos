#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"
FRONTEND_ENV_FILE="${ROOT_DIR}/frontend/.env.production"
DIST_INDEX_FILE="${ROOT_DIR}/frontend/dist/index.html"

if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
  echo "Falta ${BACKEND_ENV_FILE}" >&2
  exit 1
fi

if [[ ! -f "${FRONTEND_ENV_FILE}" ]]; then
  echo "Falta ${FRONTEND_ENV_FILE}" >&2
  exit 1
fi

if [[ ! -f "${DIST_INDEX_FILE}" ]]; then
  echo "Falta ${DIST_INDEX_FILE}. Ejecuta npm run build en frontend antes de desplegar." >&2
  exit 1
fi

set -a
source "${BACKEND_ENV_FILE}"
source "${FRONTEND_ENV_FILE}"
set +a

: "${TLS_CERT_PATH:?Falta TLS_CERT_PATH en frontend/.env.production}"
: "${TLS_KEY_PATH:?Falta TLS_KEY_PATH en frontend/.env.production}"
: "${FRONTEND_PORT:?Falta FRONTEND_PORT en frontend/.env.production}"
: "${PORT:?Falta PORT en backend/.env}"
: "${DB_HOST:?Falta DB_HOST en backend/.env}"
: "${DB_PORT:?Falta DB_PORT en backend/.env}"
: "${DB_DATABASE:?Falta DB_DATABASE en backend/.env}"
: "${DB_USERNAME:?Falta DB_USERNAME en backend/.env}"
: "${DB_PASSWORD:?Falta DB_PASSWORD en backend/.env}"

if [[ ! -f "${TLS_CERT_PATH}" ]]; then
  echo "No existe el certificado TLS configurado: ${TLS_CERT_PATH}" >&2
  exit 1
fi

if [[ ! -f "${TLS_KEY_PATH}" ]]; then
  echo "No existe la llave TLS configurada: ${TLS_KEY_PATH}" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "No se encontro psql en el contenedor." >&2
  exit 1
fi

echo "Verificando conectividad PostgreSQL..."
PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USERNAME}" \
  -d "${DB_DATABASE}" \
  -c 'SELECT 1;' >/dev/null

echo "Iniciando o recargando backend y frontend con PM2..."
cd "${ROOT_DIR}"
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
pm2 status
