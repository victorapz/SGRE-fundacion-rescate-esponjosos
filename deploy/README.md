# Despliegue en Contenedor Administrado

> Esta configuración documenta el entorno académico de despliegue. Direcciones
> reales, certificados, credenciales y configuraciones privadas se mantienen
> fuera del repositorio; los valores de este documento son ejemplos o
> placeholders.

## Inspeccion tecnica realizada

1. El backend carga variables desde `backend/src/config/configEnv.js`. Antes cargaba `backend/src/config/.env`; ahora busca `backend/.env` y mantiene fallback al path legacy para transicion.
2. Express escucha en `backend/src/index.js` mediante `app.listen(PORT, APP_HOST)`.
3. PostgreSQL se configuraba en `backend/src/config/configDb.js` usando `HOST` y `port: 5432` hardcodeado. Ahora usa `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`.
4. Axios se crea en `frontend/src/api/axios.js` y toma `baseURL` desde `getConfiguredApiBaseUrl()` en `frontend/src/utils/publicDonation.js`.
5. Los servicios frontend no agregan `/api`; `VITE_API_URL` ya debe incluirlo.
6. CORS estaba inline en `backend/src/index.js` con `PUBLIC_FRONTEND_URL` y `http://localhost:5173`. Ahora se controla con `CORS_ALLOWED_ORIGINS` y no usa credenciales por defecto.
7. Access token y refresh token se entregan por JSON desde `/api/auth/login`.
8. La autenticacion usa `localStorage` y header `Authorization: Bearer ...`; no usa cookies ni `sessionStorage` para login.
9. PayPal se configura desde `backend/src/config/configEnv.js` y `backend/src/services/paypal/paypal.service.js`.
10. La ruta exacta del webhook es `POST /api/webhooks/paypal`.
11. El cliente MinIO se construye en `backend/src/services/minio.service.js` usando `backend/src/config/minio.config.js`.
12. Los buckets se validan/crean con `ensureBucketExists()` y `ensureConfiguredBuckets()` en `backend/src/services/minio.service.js`.
13. Scripts npm actuales:
   - `backend`: `dev`, `start`
   - `frontend`: `dev`, `build`, `lint`, `preview`, `start`
14. No existia configuracion previa de PM2 ni despliegue. Se agregaron `ecosystem.config.cjs`, `ecosystem.ngrok.config.cjs` y scripts `deploy/`.
15. No existia endpoint de salud. Ahora existe `GET /api/health`.

## Archivos de entorno

- Backend: `backend/.env`
- Frontend build y servidor HTTPS: `frontend/.env.production`

El frontend usa variables `VITE_*` en build time. Si cambia `VITE_API_URL` o `VITE_PUBLIC_SITE_URL`, debes volver a ejecutar `npm run build` en `frontend`.

## Variables principales de backend

```env
PORT=80
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=...
CORS_ALLOWED_ORIGINS=https://SERVER_IP:3443
PUBLIC_FRONTEND_URL=https://SERVER_IP:3443
BACKEND_PUBLIC_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app
```

## Variables principales de frontend

```env
VITE_API_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app/api
VITE_PAYPAL_ENV=sandbox
VITE_PUBLIC_SITE_URL=https://SERVER_IP:3443
FRONTEND_PORT=3443
TLS_CERT_PATH=/root/certificates/frontend.crt
TLS_KEY_PATH=/root/certificates/frontend.key
```

## Certificado autofirmado

Genera el certificado fuera del repositorio, por ejemplo en `/root/certificates`:

```bash
mkdir -p /root/certificates
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout /root/certificates/frontend.key \
  -out /root/certificates/frontend.crt \
  -subj "/C=CL/ST=Biobio/L=Concepcion/O=Universidad/CN=SERVER_IP" \
  -addext "subjectAltName=IP:SERVER_IP"
chmod 600 /root/certificates/frontend.key
chmod 644 /root/certificates/frontend.crt
```

Reemplaza `SERVER_IP` por la IP real del servidor.

## PM2

Backend + frontend:

```bash
pm2 startOrReload ecosystem.config.cjs --env production
pm2 logs fundacion-backend
pm2 logs fundacion-frontend
```

Ngrok por separado:

```bash
pm2 startOrReload ecosystem.ngrok.config.cjs --env production
pm2 logs fundacion-ngrok
```

## Scripts operativos

Hazlos ejecutables una vez:

```bash
chmod +x deploy/*.sh
```

Inicio backend + frontend:

```bash
./deploy/start-production.sh
```

Detener backend + frontend:

```bash
./deploy/stop-production.sh
```

Inicio ngrok:

```bash
./deploy/start-ngrok.sh
```

Detener ngrok:

```bash
./deploy/stop-ngrok.sh
```

## Configuracion externa de ngrok

- Binario esperado: `ngrok`
- Configuracion externa recomendada: `/root/.config/ngrok/ngrok.yml`
- Comando manual equivalente:

```bash
ngrok http http://127.0.0.1:80
```

No incluyas `authtoken`, dominios reservados ni configuracion privada de ngrok dentro de Git.

## Pruebas operativas recomendadas

Salud backend:

```bash
curl http://127.0.0.1:80/api/health
```

Frontend HTTPS:

```bash
curl -k https://127.0.0.1:${FRONTEND_PORT}
```

MinIO desde el contenedor de la aplicacion:

```bash
curl -I "http://${MINIO_ENDPOINT}:${MINIO_PORT}/minio/health/live"
```

Si `MINIO_USE_SSL=true`, usa `https://` en la prueba anterior.

Webhook PayPal:

- URL esperada: `https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/webhooks/paypal`
- Verifica `/api/health` primero.
- Luego crea una orden Sandbox y confirma que el backend reciba el webhook.
- Revisa logs:

```bash
pm2 logs fundacion-backend
```

## Reinicio vs recreacion del contenedor

- Reinicio normal del mismo contenedor:
  - Los archivos del repo, `backend/.env`, `frontend/.env.production`, `dist`, certificados y cambios manuales en `/entrypoint.sh` suelen seguir presentes.
  - Puedes usar el bloque sugerido por `deploy/container-entrypoint-snippet.sh` para recuperar la aplicacion.

- Recreacion completa del contenedor desde imagen:
  - Los cambios manuales en `/entrypoint.sh` pueden perderse.
  - Certificados fuera del repo, binarios instalados manualmente y configuraciones no montadas pueden perderse.
  - Vuelve a copiar el repo, reinstalar dependencias, reconstruir frontend, restaurar `.env`, certificados y reinsertar manualmente el snippet del entrypoint si corresponde.
