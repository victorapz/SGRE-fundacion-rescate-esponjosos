# Sistema de Gestión para Fundación Rescate Esponjosos

Proyecto desarrollado como tesis de Ingeniería Civil Informática.

## Configuración local y seguridad

Las credenciales, certificados, tokens y configuraciones de infraestructura no
forman parte del repositorio. Copia `backend/.env.example` y
`frontend/.env.example` a los archivos de entorno locales que corresponda y
configúralos fuera de Git. Las variables `VITE_*` se incorporan al navegador,
por lo que solo deben contener información destinada a ser pública.

## Descripción

Sistema web para digitalizar y centralizar procesos internos y externos
de Fundación Rescate Esponjosos.

## Funcionalidades

- Gestión de usuarios, roles y permisos
- Gestión de animales rescatados
- Historial clínico
- Hogares temporales
- Turnos y tareas
- Inventario
- Compras y donaciones
- Contabilidad
- Informes
- Donaciones monetarias
- Apadrinamientos
- Integración PayPal
- Gestión de archivos
- Portal público

## Stack

Frontend
- React
- Vite
- Axios

Backend
- Node.js
- Express
- TypeORM

Base de datos
- PostgreSQL

Infraestructura
- MinIO
- PM2
- ngrok

Integraciones
- PayPal REST API
