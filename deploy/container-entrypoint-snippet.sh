#!/usr/bin/env bash
set -euo pipefail

cat <<'SNIPPET'
# --- Inicio sugerido para /entrypoint.sh antes de tail -f /dev/null ---
if [ -f /root/SistemaGestionFundacion/ecosystem.config.cjs ]; then
  (
    cd /root/SistemaGestionFundacion || exit 1
    pm2 startOrReload ecosystem.config.cjs --env production \
      || echo "[entrypoint] No fue posible iniciar backend/frontend con PM2."

    if [ -f /root/SistemaGestionFundacion/ecosystem.ngrok.config.cjs ] \
      && command -v ngrok >/dev/null 2>&1 \
      && [ -f "${NGROK_CONFIG_PATH:-/root/.config/ngrok/ngrok.yml}" ]; then
      pm2 startOrReload ecosystem.ngrok.config.cjs --env production \
        || echo "[entrypoint] No fue posible iniciar ngrok con PM2."
    else
      echo "[entrypoint] ngrok omitido: falta binario, configuracion externa o ecosystem.ngrok.config.cjs."
    fi
  ) || echo "[entrypoint] No fue posible cambiar al directorio /root/SistemaGestionFundacion."
else
  echo "[entrypoint] ecosystem.config.cjs no existe; se omite el arranque de la aplicacion."
fi
# --- Fin sugerido ---
SNIPPET
