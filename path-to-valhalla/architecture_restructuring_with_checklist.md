# Plan de reestructuracion de backend y frontend

Fecha de revision: 2026-06-15

## Alcance

Este plan cubre solo los proyectos:

- `path-to-valhalla/backend`
- `path-to-valhalla/frontend`

No incluye una reestructuracion propia de `packages`, reglas de Firestore, infraestructura externa ni assets como proyecto separado. Cuando algo externo impacta a `backend` o `frontend`, se menciona solo como dependencia o riesgo.

## Objetivo

Reestructurar ambos proyectos para que sean mas escalables, seguros y practicos de mantener sin detener el desarrollo del juego. La idea no es reescribir todo, sino ordenar responsabilidades, reducir duplicacion, centralizar seguridad y permitir que cada dominio del juego evolucione con bajo acoplamiento.

Principios:

- Separar entrada HTTP, reglas de negocio, acceso a datos y serializacion.
- Evitar que componentes de UI hagan llamadas `fetch` directas o manejen detalles de autenticacion.
- Centralizar configuracion, secretos, errores, validacion y logging.
- Migrar por fases pequeñas, verificables y reversibles.
- Mantener compatibilidad funcional mientras se mueven archivos.

## Estado actual general

El codigo principal esta dentro de `path-to-valhalla/`, con dos proyectos claros:

- `backend`: API Express con Socket.IO, Firebase Admin y Firestore.
- `frontend`: React con Vite, React Router, Tailwind, Firebase Client SDK y Socket.IO client.

Hay un `package.json` de monorepo en `path-to-valhalla/package.json` con workspaces para `backend`, `frontend` y `packages/shared`, pero la reestructuracion solicitada debe concentrarse en `backend` y `frontend`.

Tambien se detecto un estado de trabajo con cambios pendientes. Antes de mover archivos de forma masiva, conviene estabilizar el arbol de trabajo para no mezclar reestructuracion con cambios funcionales.

## Estado actual del backend

### Estructura observada

```text
backend/
  server.js
  package.json
  src/
    config/
      db.js
      firebaseAdmin.js
    constants/
    controllers/
    middleware/
    models/
    routes/
    services/
    app.js
```

## Estado actual del frontend

### Estructura observada

```text
frontend/
  index.html
  package.json
  src/
    components/
    hooks/
    lib/
    modules/
      auth/
      player/
      inventory/
      expedition/
    providers/
    routes/ 
    services/
    App.jsx
    main.jsx
```

## Requisitos de seguridad

- No dejar secretos en `src`.
- No usar fallbacks inseguros.
- Usar middlewares globales para autenticación y autorización.
- Validar entradas en todos los endpoints críticos.

## Estilo de código

- Consistente con el estilo del proyecto.
- Seguir las mejores prácticas de Express y React.
- Documentar componentes y funciones complejas.

## Requisitos técnicos

### Backend

- Utilizar TypeScript o JavaScript moderno.
- Estructura modular por dominios.
- Manejo centralizado de errores.
- Uso de middleware para autenticación.
- Validaciones de datos robustas.
- Logging consistente.
- Configuración centralizada en `.env`.
- Middlewares globales para CORS, body parsing, etc.

### Frontend

- React Hooks y functional components.
- Gestión centralizada del estado (providers).
- Componentes reutilizables.
- Manejo de errores y cargas.
- Routing con React Router v6.

## Prioridades recomendadas

| Prioridad | Area | Motivo |
| --- | --- | --- |
| Alta | `backend/package.json` | Bloquea tooling y automatizacion. |
| Alta | Secretos y service account | Riesgo critico de seguridad. |
| Alta | JWT, CORS, admin routes | Riesgo directo de acceso no autorizado. |
| Alta | API client frontend | Reduce duplicacion y errores de sesion. |
| Media | Separar `app.js` y `server.js` | Habilita tests y despliegue mas limpio. |
| Media | Modulos backend | Reduce acoplamiento por dominio. |
| Media | Providers frontend | Reduce complejidad de `App.jsx`. |
| Media | Tests minimos | Evita regresiones durante movimientos. |
| Baja | Limpieza estetica de carpetas | Debe hacerse despues de asegurar comportamiento. |

## Definition of done

La reestructuracion se considera completa cuando:

- Backend y frontend instalan dependencias de forma reproducible.
- Backend no contiene secretos en `src` ni fallbacks inseguros.
- Backend tiene `app.js`, `server.js`, configuracion centralizada, middlewares globales y modulos por dominio.
- Frontend tiene providers globales, cliente API centralizado y features por dominio.
- No hay `fetch` directo ni lectura directa de `localStorage` en paginas nuevas o migradas.
- Rutas admin tienen control de permisos.
- Los endpoints criticos validan payloads.
- Hay tests minimos para auth, economia, inventario, mensajes y flujos frontend principales.
- La documentacion de cada proyecto explica scripts, variables de entorno y estructura.

## Orden practico de ejecucion

1. Arreglar tooling y secretos.
2. Centralizar config, auth, errores y API client.
3. Separar runtime backend (`app.js` / `server.js`).
4. Extraer providers frontend.
5. Migrar un dominio pequeno de punta a punta, recomendado `bank` o `messages`.
6. Repetir el patron por dominios de mayor complejidad.
7. Agregar tests por cada dominio migrado.
8. Limpiar compatibilidad temporal y documentar estructura final.

Este orden reduce riesgo porque primero cierra seguridad y tooling, luego crea la base compartida, y despues mueve dominios de forma incremental.

## Checklist de dominios implementados

- [x] auth (autenticación)
- [x] player (jugadores)
- [x] inventory (inventario)
- [x] expedition (expediciones)
- [ ] quest (misiones)
- [ ] shop (tienda) 
- [ ] workshop (taller)
- [ ] bank (banco)
- [ ] message (mensajes)
- [ ] pet (mascotas)
- [ ] background (fondos)
- [ ] skill (habilidades)
- [ ] evolution (evolución)
- [ ] package (paquetes)