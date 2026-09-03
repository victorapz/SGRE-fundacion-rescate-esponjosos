#!/usr/bin/env bash
set -euo pipefail

PROJECT_APPS=(
  "fundacion-backend"
  "fundacion-frontend"
)

for app_name in "${PROJECT_APPS[@]}"; do
  if pm2 describe "${app_name}" >/dev/null 2>&1; then
    pm2 stop "${app_name}" >/dev/null
  fi
done

pm2 status
