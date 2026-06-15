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
    routes/
    seeds/
    shared/
    utils/
    socket.js
    serviceAccountKey.json
```

### Como funciona hoy

- `server.js` carga variables de entorno, crea la app Express, registra rutas, inicializa Socket.IO y ejecuta `ensureInitialGameData()` al arrancar.
- Las rutas viven en `src/routes/*Routes.js`.
- La logica HTTP y buena parte de la logica de negocio viven juntas en `src/controllers/*Controller.js`.
- Firestore y Firebase Admin se inicializan desde `src/config/db.js` y `src/config/firebaseAdmin.js`.
- La autenticacion mezcla JWT propio y Firebase ID token mediante `src/utils/sessionAuth.js`.
- Socket.IO se inicializa en `src/socket.js` y reutiliza la misma resolucion de usuario.
- Parte de la logica de dominio vive en `src/shared`, por ejemplo stats, XP y generacion de enemigos.

### Problemas principales

- `backend/package.json` actualmente no parsea como JSON por un caracter invalido en `dependencies`. Esto bloquea instalacion, scripts y automatizacion confiable.
- `server.js` hace demasiadas cosas: configura Express, importa rutas, inicializa sockets, corre seeds y levanta el servidor.
- Hay duplicacion de configuracion Firebase entre `config/db.js` y `config/firebaseAdmin.js`.
- `src/serviceAccountKey.json` esta dentro del codigo fuente y aparece trackeado por Git. Es un riesgo critico de seguridad.
- `.gitignore` tiene comentadas exclusiones para `.env` y service accounts, por lo que secretos pueden entrar al repo.
- `JWT_SECRET` tiene fallback hardcodeado (`valhalla_secret_key_odin`). En produccion debe ser obligatorio.
- `cors()` esta abierto y Socket.IO usa `origin: '*'`.
- `helmet` esta declarado como dependencia, pero no se aplica en `server.js`.
- No se observa rate limiting, validacion centralizada de payloads, sanitizacion ni middleware global de errores.
- La ruta admin `/api/admin/give-item` solo exige autenticacion, pero no rol/permisos de administrador.
- Muchos controladores contienen reglas de negocio, consultas Firestore, validaciones y formato de respuesta en el mismo archivo.
- Los seeds se ejecutan en cada arranque del servidor; conviene separarlos del ciclo normal de runtime.
- No se detecta suite de tests backend.

## Estado actual del frontend

### Estructura observada

```text
frontend/
  vite.config.js
  package.json
  src/
    App.jsx
    main.jsx
    components/
    components/layout/
    constants/
    lib/
    pages/
    services/
    shared/
    assets/
  public/
```

### Como funciona hoy

- `App.jsx` controla restauracion de sesion, logout, routing, Socket.IO, contador de mensajes y seleccion de vista inicial.
- Las paginas principales estan en `src/pages`.
- Las llamadas HTTP se hacen mayormente desde paginas y componentes con `fetch` directo.
- `src/services/messageService.js` ya es una primera extraccion de servicio, pero el patron no esta aplicado al resto de dominios.
- `localStorage` se usa directamente en varias paginas para leer `token` y `user`.
- Firebase Client SDK esta en `src/lib/firebase.js`.
- La configuracion de API esta en `src/constants/api.js`.

### Problemas principales

- `App.jsx` concentra demasiadas responsabilidades: sesion, sockets, rutas, estado global y decisiones de pantalla.
- Las paginas son grandes y mezclan UI, estado, efectos, llamadas HTTP, transformacion de datos y manejo de errores. Ejemplos: `HeroOverview.jsx`, `Expeditions.jsx`, `ValhallaHall.jsx`, `Market.jsx`, `Bank.jsx`.
- Hay llamadas `fetch` directas en casi todas las paginas, con headers de autenticacion repetidos.
- El token se lee desde `localStorage` en muchos puntos, lo que aumenta duplicacion y superficie de errores.
- No hay cliente HTTP centralizado con interceptores simples, manejo uniforme de errores o logout automatico en `401`.
- No hay providers claros para Auth, Socket, User/Profile o notificaciones.
- La configuracion Firebase tiene valores fallback hardcodeados. Aunque las claves web de Firebase no son secretas como una service account, conviene mover todo a `.env.example` y validar entorno.
- `getAnalytics(app)` se ejecuta siempre; conviene protegerlo por entorno/navegador si se requiere compatibilidad mas amplia.
- No se detecta suite de tests frontend.

## Arquitectura objetivo del backend

Estructura propuesta:

```text
backend/
  server.js
  src/
    app.js
    config/
      env.js
      firebase.js
      cors.js
    middlewares/
      auth.middleware.js
      admin.middleware.js
      error.middleware.js
      not-found.middleware.js
      rate-limit.middleware.js
      validate.middleware.js
    shared/
      errors/
      firestore/
      http/
      logger/
      security/
      utils/
    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.schemas.js
        auth.mapper.js
      player/
      inventory/
      expedition/
      quest/
      shop/
      workshop/
      bank/
      package/
      message/
      pet/
      background/
      skill/
      evolution/
    realtime/
      socket.js
      events.js
    jobs/
      seed-game-data.js
    tests/
```

Reglas de organizacion:

- `routes`: solo definen endpoints, middlewares y delegan al controller.
- `controller`: traduce HTTP a casos de uso, no contiene consultas complejas.
- `service`: contiene reglas de negocio y orquesta transacciones.
- `repository`: encapsula Firestore.
- `schemas`: valida `body`, `params` y `query`.
- `mapper`: transforma documentos Firestore a DTOs de API.
- `shared`: solo utilidades transversales, no logica de dominios especificos.

## Arquitectura objetivo del frontend

Estructura propuesta:

```text
frontend/
  src/
    app/
      App.jsx
      router.jsx
      providers.jsx
    shared/
      api/
        client.js
        endpoints.js
        errors.js
      auth/
        AuthProvider.jsx
        useAuth.js
        tokenStorage.js
      socket/
        SocketProvider.jsx
        useSocket.js
      config/
        env.js
      ui/
      utils/
    features/
      auth/
      hero/
      inventory/
      expeditions/
      valhalla/
      market/
      workshop/
      bank/
      messages/
      bestiary/
      grimoire/
      pets/
      backgrounds/
    assets/
    main.jsx
```

Reglas de organizacion:

- `app`: wiring principal, providers y rutas.
- `shared/api`: unico punto para `fetch`, headers, errores, base URL y parseo.
- `shared/auth`: sesion, token, usuario actual, login/logout y restauracion.
- `shared/socket`: conexion Socket.IO autenticada y eventos globales.
- `features/<dominio>`: pagina, componentes especificos, hooks y servicio API de ese dominio.
- Las paginas no deben construir headers ni leer `localStorage` directamente.
- Los componentes de UI deben recibir datos y callbacks; no deben conocer endpoints salvo que sean contenedores de feature.

## Contratos recomendados

API:

```json
{
  "data": {},
  "error": null,
  "meta": {}
}
```

Errores:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje seguro para cliente",
    "details": []
  },
  "meta": {}
}
```

Buenas practicas:

- Versionar endpoints nuevos bajo `/api/v1`.
- Mantener endpoints actuales durante la migracion para no romper frontend.
- Normalizar `id`, fechas ISO y nombres de campos antes de responder.
- Usar paginacion estable en listados grandes: mensajes, paquetes, inventario, bestiario.
- Evitar exponer datos internos de Firestore o stack traces al cliente.

## Plan por fases

### Fase 0 - Estabilizacion previa

Objetivo: dejar el repo en condiciones para mover archivos sin romper la base.

Pasos:

- Corregir `backend/package.json` para que sea JSON valido.
- Decidir si se usara un lockfile por workspace o un lockfile de monorepo, y dejar de ignorar el lockfile elegido.
- Confirmar que `backend` y `frontend` instalan dependencias desde cero.
- Agregar scripts claros:
  - Backend: `dev`, `start`, `lint`, `test`.
  - Frontend: `dev`, `build`, `lint`, `test`.
- Documentar variables requeridas en `.env.example` para backend y frontend.
- Separar cambios funcionales pendientes de la reestructuracion.

Criterio de salida:

- `npm install`, `npm run lint` y `npm run build` o equivalente tienen un estado conocido.
- No hay secretos nuevos agregados al codigo.

### Fase 1 - Seguridad base

Objetivo: cerrar riesgos antes de crecer la arquitectura.

Backend:

- Sacar `serviceAccountKey.json` de `src` y cargar credenciales desde variables de entorno o secret manager.
- Rotar la service account si el archivo ya fue compartido o trackeado.
- Hacer obligatorio `JWT_SECRET`; eliminar fallback hardcodeado.
- Consolidar Firebase Admin en un solo archivo `src/config/firebase.js`.
- Aplicar `helmet`.
- Configurar CORS por allowlist desde env.
- Configurar Socket.IO con la misma allowlist de origen.
- Agregar rate limiting a login, registro, Firebase login y endpoints sensibles.
- Agregar `express.json({ limit: '...' })`.
- Crear middleware de errores global y respuestas seguras.
- Crear `admin.middleware.js` con roles/permisos reales antes de permitir rutas admin.
- Agregar validacion de requests con esquemas por endpoint.

Frontend:

- Centralizar acceso a token en `shared/auth/tokenStorage.js`.
- Centralizar llamadas HTTP en `shared/api/client.js`.
- Manejar `401` en un solo lugar con limpieza de sesion.
- Mover configuracion Firebase a env validado, sin fallbacks silenciosos para entornos productivos.

Criterio de salida:

- No hay secretos de servidor dentro de `src`.
- Ninguna ruta admin depende solo de "usuario autenticado".
- CORS, JWT y Firebase se configuran por entorno.

### Fase 2 - Separacion de entrada y runtime del backend

Objetivo: que el servidor sea testeable y modular.

Pasos:

- Crear `src/app.js` para configurar Express y rutas.
- Dejar `server.js` solo para leer env, crear HTTP server, inicializar Socket.IO y escuchar puerto.
- Mover `src/socket.js` a `src/realtime/socket.js`.
- Mover `ensureInitialGameData()` fuera del arranque normal y convertirlo en script o job explicito.
- Agregar endpoints de salud:
  - `GET /health`
  - `GET /ready`
- Crear `src/routes/index.js` para montar rutas por version.

Criterio de salida:

- La app Express puede importarse en tests sin abrir puerto.
- El seed no corre automaticamente en cada deploy.

### Fase 3 - Modularizacion backend por dominio

Objetivo: mover dominios sin cambiar comportamiento.

Orden recomendado:

1. `auth`: por ser transversal y sensible.
2. `player`: porque alimenta perfil, raza, stats, skills y busqueda.
3. `inventory` y `package`: comparten item ownership y movimientos.
4. `shop`, `bank` y `workshop`: manejan economia y transacciones.
5. `expedition`, `quest`, `evolution`, `skill`: reglas de progresion.
6. `message`: integrar mejor eventos realtime.
7. `pet`, `background`, `bestiary`: dominios de menor acoplamiento.

Para cada dominio:

- Crear carpeta en `src/modules/<dominio>`.
- Mover routes, controller y logica asociada.
- Extraer reglas de negocio a service.
- Extraer Firestore a repository.
- Agregar schemas de validacion.
- Agregar mapper de respuesta.
- Mantener el endpoint publico igual durante la migracion.
- Agregar tests unitarios del service y tests HTTP minimos del route/controller.

Criterio de salida:

- Cada dominio puede modificarse sin tocar controladores de otros dominios.
- Las transacciones Firestore quedan en services/repositorios, no mezcladas con UI HTTP.

### Fase 4 - Reestructuracion frontend base

Objetivo: sacar responsabilidades globales de `App.jsx`.

Pasos:

- Crear `src/app/router.jsx` con rutas.
- Crear `src/app/providers.jsx` para Auth, Socket y otros providers globales.
- Crear `shared/api/client.js` con:
  - base URL
  - headers auth
  - parseo JSON
  - manejo uniforme de errores
  - logout o evento global en `401`
- Crear `shared/auth/AuthProvider.jsx` para:
  - restaurar sesion
  - guardar usuario actual
  - actualizar perfil
  - logout
  - exponer `useAuth()`
- Crear `shared/socket/SocketProvider.jsx` para:
  - conectar al tener token
  - desconectar en logout
  - exponer eventos y socket actual
- Reducir `App.jsx` a wiring principal.

Criterio de salida:

- `App.jsx` deja de manejar detalles de socket, token y llamadas directas al perfil.
- Ningun componente nuevo debe leer `localStorage` directamente.

### Fase 5 - Modularizacion frontend por feature

Objetivo: que cada pantalla del juego tenga su API, hooks y UI local.

Orden recomendado:

1. `messages`: ya tiene `messageService`, es buen candidato para completar el patron.
2. `bank`: dominio pequeno con operaciones claras.
3. `market`: compra, venta y refresh de tienda.
4. `workshop`: profesion y craft.
5. `grimoire`: skills equip/upgrade.
6. `hero`: dividir `HeroOverview.jsx` por secciones.
7. `expeditions`: dividir datos de zona, enemigos y batalla.
8. `valhalla`, `bestiary`, `packages`.

Para cada feature:

- Crear `features/<feature>/api.js`.
- Crear hooks como `useBank`, `useMarket`, `useExpeditions`.
- Mover componentes especificos a `features/<feature>/components`.
- Mantener componentes compartidos en `shared/ui` solo si son reutilizables por mas de una feature.
- Sustituir `fetch` directo por `apiClient`.
- Sustituir acceso directo a token por `useAuth()`.
- Agregar estados consistentes: loading, empty, error, success.

Criterio de salida:

- Las paginas quedan como composicion de hooks y componentes.
- La logica HTTP no esta mezclada con markup.

### Fase 6 - Datos compartidos y duplicacion

Objetivo: evitar reglas duplicadas entre backend y frontend.

Pasos:

- Identificar duplicados reales:
  - `level_xp.js`
  - `player_stats.js`
  - constantes de stats, clases, rarezas, monedas, slots.
- Decidir una unica fuente de verdad.
- Si se mantiene `packages/shared`, consumirlo desde backend y frontend como dependencia del workspace.
- Si no se usa `packages/shared`, dejar claro que backend es fuente de verdad y frontend solo recibe DTOs.
- Evitar que frontend replique reglas criticas de economia, combate o progresion.

Criterio de salida:

- La logica que afecta recompensas, monedas, combate o stats vive en backend.
- El frontend solo calcula derivaciones visuales no criticas.

### Fase 7 - Tests y calidad

Objetivo: proteger la reestructuracion y permitir refactors futuros.

Backend:

- Unit tests para services de economia, inventario, batalla, quests y mensajes.
- Tests de rutas para auth, permisos y validacion.
- Tests de transacciones criticas con Firestore mock o entorno controlado.
- Tests de autorizacion para rutas admin.

Frontend:

- Tests de `apiClient`, AuthProvider y SocketProvider.
- Tests de hooks por feature.
- Tests de render para pantallas criticas: login, hero, market, bank, expeditions.
- E2E minimo para flujo login, seleccionar raza, ver hero y ejecutar una accion no destructiva.

Criterio de salida:

- Cada dominio migrado tiene pruebas minimas antes de continuar al siguiente.
- `lint`, `build` y tests pasan antes de mezclar cambios.

### Fase 8 - Limpieza final

Objetivo: retirar compatibilidad temporal y deuda creada durante la migracion.

Pasos:

- Eliminar rutas o servicios antiguos ya reemplazados.
- Eliminar imports obsoletos.
- Revisar nombres de carpetas y convenciones.
- Documentar estructura final en README de backend y frontend.
- Revisar `.gitignore` para secretos, logs, dist, node_modules y caches.
- Revisar que `dist`, logs y archivos locales no queden versionados.

Criterio de salida:

- La estructura final coincide con la arquitectura objetivo.
- No quedan llamadas `fetch` directas fuera del cliente HTTP aprobado.
- No quedan secretos ni service accounts en el codigo fuente.

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
- [x] auth
- [x] player
- [x] inventory
- [x] expedition
- [ ] quest
- [ ] shop
- [ ] workshop
- [ ] bank
- [ ] message
- [ ] pet
- [ ] background
- [ ] skill
- [ ] evolution
- [ ] package
