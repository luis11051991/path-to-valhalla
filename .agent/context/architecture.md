# Architecture Context

Este archivo resume la arquitectura relevante del proyecto para agentes.

Actualizar cuando cambien decisiones importantes sobre:

- backend;
- frontend;
- contratos API;
- base de datos;
- autenticacion;
- estructura de carpetas;
- migraciones o refactors grandes.

## Estado actual

- Repositorio Git con carpeta de proyecto anidada: `path-to-valhalla/`.
- Backend: `path-to-valhalla/backend`.
- Frontend: `path-to-valhalla/frontend`.
- Backend actual: Node.js, CommonJS, Express 4, PostgreSQL con `pg`, JWT, Socket.IO.
- Frontend actual: React 19, Vite, React Router, Tailwind CSS, Socket.IO client.
- Ver `PLAN_REESTRUCTURACION.md` para el plan tecnico principal.
- Ver `.github/copilot-instructions.md` para reglas detalladas del repositorio.
`n## Arquitectura objetivo desde PLAN_REESTRUCTURACION.md`n`n- Backend: `server.js` solo debe hacer bootstrap; `src/app.js` configura Express.`n- Backend: API nueva bajo `/api/v1`, con `/api` legacy temporal durante la migracion.`n- Backend: modulos por dominio con `routes`, `controller`, `service`, `repository` y `validators`.`n- Frontend: `src/api/client.js` como unico wrapper HTTP.`n- Frontend: stores dedicados para sesion y Socket.IO.`n- Frontend: features por dominio bajo `src/features/*`.`n- Compartido: `packages/shared` para reglas puras sin dependencias de frameworks.`n
