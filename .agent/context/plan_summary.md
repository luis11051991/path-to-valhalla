# Resumen del plan

## Objetivo general

Reestructurar `path-to-valhalla/backend` y `path-to-valhalla/frontend` para mejorar arquitectura, contratos API, seguridad, modularidad y consumo frontend sin romper compatibilidad funcional durante la migracion.

## Alcance

- Backend Node.js/Express/PostgreSQL con API versionada `/api/v1`.
- Frontend React/Vite reorganizado por features.
- Centralizacion de cliente HTTP, sesion y Socket.IO.
- Modularizacion backend por dominios.
- Migraciones reproducibles de base de datos.
- Paquete compartido para reglas puras.
- Limpieza de endpoints y archivos legacy al final.

## Fuera de alcance

- Ejecutar las tareas de reestructuracion durante esta migracion a `.agent/`.
- Hacer commits o push.
- Instalar dependencias.
- Modificar archivos `.env` reales.

## Notas importantes

- Mantener `/api` legacy hasta que el frontend consuma `/api/v1`.
- No aceptar `userId` enviado por cliente en endpoints autenticados nuevos.
- Ejecutar la reestructuracion fase por fase.
