#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGROK_CONFIG_PATH="${NGROK_CONFIG_PATH:-/root/.config/ngrok/ngrok.yml}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok no esta instalado en el contenedor." >&2
  exit 1
fi

if [[ ! -f "${NGROK_CONFIG_PATH}" ]]; then
  echo "No existe la configuracion externa de ngrok: ${NGROK_CONFIG_PATH}" >&2
  exit 1
fi

cd "${ROOT_DIR}"
pm2 startOrReload ecosystem.ngrok.config.cjs --env production
pm2 save
pm2 status fundacion-ngrok
echo "Logs: pm2 logs fundacion-ngrok"
