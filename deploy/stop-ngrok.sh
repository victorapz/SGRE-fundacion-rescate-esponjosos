#!/usr/bin/env bash
set -euo pipefail

if pm2 describe "fundacion-ngrok" >/dev/null 2>&1; then
  pm2 stop "fundacion-ngrok" >/dev/null
fi

pm2 status
