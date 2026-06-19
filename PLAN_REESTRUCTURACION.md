# Plan de reestructuracion de backend y frontend

## Alcance

Este documento describe un plan tecnico para reestructurar los dos proyectos actuales del repositorio:

- `path-to-valhalla/backend`
- `path-to-valhalla/frontend`

El objetivo es mejorar la arquitectura sin perder compatibilidad funcional: el frontend debe seguir consumiendo servicios del backend, pero mediante contratos mas claros, versionados y centralizados.

Este plan considera el estado actual observado en el repositorio, los cambios propuestos y el estado final esperado. No implementa cambios de codigo.

## Estado actual

### Backend actual

Tecnologias principales:

- Node.js con CommonJS.
- Express 4.
- PostgreSQL via `pg`.
- JWT con `jsonwebtoken`.
- Socket.IO para mensajeria en tiempo real.
- `bcryptjs`, `cors`, `dotenv`, `helmet` como dependencias.

Estructura actual resumida:

```txt
path-to-valhalla/backend/
  package.json
  server.js
  scripts/
    init_db.js
  sql/
    messages_schema.sql
  src/
    config/
      db.js
    constants/
      levels.js
    controllers/
      authController.js
      backgroundController.js
      bankController.js
      evolutionController.js
      expeditionController.js
      inventoryController.js
      messageController.js
      packageController.js
      petController.js
      playerController.js
      questController.js
      shopController.js
      skillController.js
      workshopController.js
    middleware/
      authMiddleware.js
    modules/
      background/
      bank/
      bestiary/
      evolution/
      expeditions/
      grimoire/
      hero/
      inventory/
      message/
      packages/
      pet/
      shop/
      skill/
      valhalla/
      workshop/
    routes/
      authRoutes.js
      bankRoutes.js
      bestiaryRoutes.js
      evolutionRoutes.js
      expeditionRoutes.js
      inventoryRoutes.js
      messageRoutes.js
      packageRoutes.js
      questRoutes.js
      shopRoutes.js
      workshopRoutes.js
    shared/
      enemy_generator.js
      level_xp.js
      player_stats.js
      xp_rewards.js
    socket.js
    utils/
      currencyUtils.js
      inventoryUtils.js
```

Problemas principales detectados:

- `server.js` mezcla bootstrap HTTP, configuracion de Express, montaje de rutas y endpoints legacy.
- Los controladores contienen demasiada responsabilidad: validacion, SQL, reglas de negocio, transacciones y forma de respuesta.
- `src/modules` ya existe como intencion modular, pero actualmente no contiene implementacion funcional.
- `src/config/db.js` tiene credenciales locales hardcodeadas. Debe moverse a variables de entorno.
- La clave JWT esta hardcodeada en `authMiddleware.js`, `authController.js` y `socket.js`.
- Hay endpoints legacy definidos directamente en `server.js`, por ejemplo `/api/login`, `/api/register`, `/api/choose-race`, `/api/my-skills`, `/api/equip-pet`.
- Algunas rutas estan duplicadas o mezcladas entre routers y `server.js`, especialmente inventario.
- Varias acciones reciben `userId` desde el frontend en body o query string. Eso debe reemplazarse por `req.user.id` desde JWT.
- `helmet` esta instalado, pero no se aplica en `server.js`.
- No hay un manejador central de errores ni formato de respuesta consistente.
- No hay esquema de migraciones completo. Solo existe script/schema para `messages`.
- `questController.refreshBoard` existe, pero `questRoutes.js` no expone `POST /api/quests/refresh`, aunque el frontend lo consume.

### Frontend actual

Tecnologias principales:

- React 19.
- Vite.
- React Router.
- Tailwind CSS.
- Socket.IO client.
- Zustand instalado, pero no se observa uso estructural en el estado actual.
- `fetch` directo para consumir backend.

Estructura actual resumida:

```txt
path-to-valhalla/frontend/
  package.json
  vite.config.js
  tailwind.config.js
  src/
    App.jsx
    main.jsx
    index.css
    constants/
      api.js
      races.js
    services/
      messageService.js
    shared/
      level_xp.js
    components/
      Auth.jsx
      RaceSelection.jsx
      Dashboard_old.jsx
      EvolutionModal.jsx
      OnixShopModal.jsx
      StatsPanel.jsx
      WelcomeBack.jsx
      layout/
        GameLayout.jsx
        Sidebar.jsx
        TopBar.jsx
    pages/
      Bank.jsx
      Bestiary.jsx
      Expeditions.jsx
      Grimoire.jsx
      HeroOverview.jsx
      Market.jsx
      MessagingPage.jsx
      Packages.jsx
      ValhallaHall.jsx
      Workshop.jsx
    assets/
    public/
```

Problemas principales detectados:

- `App.jsx` maneja demasiadas responsabilidades: sesion, socket, rutas, layout y contador de mensajes.
- La mayor parte del consumo HTTP esta dispersa en paginas y componentes.
- Solo existe un servicio formal: `services/messageService.js`.
- Los headers de autenticacion se repiten en muchos archivos y alternan entre `Authorization` y `x-auth-token`.
- El token y el usuario se leen directamente de `localStorage` en multiples componentes.
- No hay cliente HTTP central con manejo uniforme de errores, parseo JSON, expiracion de sesion o reintentos.
- Las paginas contienen mezcla de UI, transformaciones de datos, reglas de negocio de presentacion y llamadas HTTP.
- Hay duplicacion conceptual entre `frontend/src/shared/level_xp.js` y `backend/src/shared/level_xp.js`.
- `Dashboard_old.jsx` parece ser codigo legado todavia en el arbol del proyecto.

## Objetivos de la reestructuracion

1. Separar responsabilidades en backend:
   - Rutas solo definen contrato HTTP.
   - Controladores traducen HTTP a casos de uso.
   - Servicios contienen reglas de negocio.
   - Repositorios contienen SQL.
   - Validadores normalizan y validan input.

2. Versionar la API:
   - Nueva base: `/api/v1`.
   - Mantener `/api` temporalmente como compatibilidad durante la migracion.

3. Centralizar el consumo del backend en frontend:
   - Un cliente HTTP unico.
   - Servicios por dominio.
   - Hooks o stores que consuman esos servicios.
   - Componentes enfocados en UI.

4. Mejorar seguridad:
   - JWT secret desde `.env`.
   - DB config desde `.env`.
   - Acciones protegidas por `Authorization: Bearer <token>`.
   - No aceptar `userId` desde el cliente para acciones del usuario autenticado.
   - Proteger endpoints admin.

5. Estandarizar contratos:
   - Respuestas consistentes.
   - Errores consistentes.
   - Validacion de body, params y query.
   - Contratos reutilizables por frontend y backend cuando aplique.

6. Reducir duplicacion:
   - Extraer utilidades puras compartidas a un paquete comun.
   - Eliminar servicios duplicados o legacy cuando ya no se usen.

## Arquitectura objetivo del backend

### Estructura final propuesta

```txt
path-to-valhalla/backend/
  package.json
  .env.example
  server.js
  src/
    app.js
    config/
      env.js
      cors.js
    db/
      pool.js
      transaction.js
      migrations/
      seeds/
    api/
      v1/
        router.js
    middleware/
      requireAuth.js
      requireAdmin.js
      validateRequest.js
      errorHandler.js
      notFound.js
    lib/
      asyncHandler.js
      ApiError.js
      httpResponse.js
      logger.js
    realtime/
      socketServer.js
      events.js
    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.validators.js
      hero/
        hero.routes.js
        hero.controller.js
        hero.service.js
        hero.repository.js
        hero.validators.js
      inventory/
        inventory.routes.js
        inventory.controller.js
        inventory.service.js
        inventory.repository.js
        inventory.validators.js
      packages/
        packages.routes.js
        packages.controller.js
        packages.service.js
        packages.repository.js
        packages.validators.js
      shop/
        shop.routes.js
        shop.controller.js
        shop.service.js
        shop.repository.js
        shop.validators.js
      bank/
        bank.routes.js
        bank.controller.js
        bank.service.js
        bank.repository.js
        bank.validators.js
      quests/
        quests.routes.js
        quests.controller.js
        quests.service.js
        quests.repository.js
        quests.validators.js
      expeditions/
        expeditions.routes.js
        expeditions.controller.js
        expeditions.service.js
        expeditions.repository.js
        expeditions.validators.js
      bestiary/
        bestiary.routes.js
        bestiary.controller.js
        bestiary.service.js
        bestiary.repository.js
      evolution/
        evolution.routes.js
        evolution.controller.js
        evolution.service.js
        evolution.repository.js
        evolution.validators.js
      skills/
        skills.routes.js
        skills.controller.js
        skills.service.js
        skills.repository.js
        skills.validators.js
      pets/
        pets.routes.js
        pets.controller.js
        pets.service.js
        pets.repository.js
        pets.validators.js
      backgrounds/
        backgrounds.routes.js
        backgrounds.controller.js
        backgrounds.service.js
        backgrounds.repository.js
        backgrounds.validators.js
      messages/
        messages.routes.js
        messages.controller.js
        messages.service.js
        messages.repository.js
        messages.validators.js
        messages.events.js
      users/
        users.routes.js
        users.controller.js
        users.service.js
        users.repository.js
      admin/
        admin.routes.js
        admin.controller.js
        admin.service.js
    shared/
      game/
        levelXp.js
        playerStats.js
        enemyGenerator.js
        xpRewards.js
      money/
        currency.js
```

### Responsabilidades por capa

`server.js`

- Crear servidor HTTP.
- Inicializar Socket.IO.
- Leer puerto desde `env`.
- Arrancar `listen`.

`src/app.js`

- Crear instancia Express.
- Aplicar middlewares globales: `helmet`, `cors`, `express.json`.
- Montar `/api/v1`.
- Montar compatibilidad `/api` durante la migracion.
- Montar `notFound` y `errorHandler`.

`api/v1/router.js`

- Montar todos los modulos versionados:
  - `/auth`
  - `/hero`
  - `/inventory`
  - `/packages`
  - `/shop`
  - `/bank`
  - `/quests`
  - `/expeditions`
  - `/bestiary`
  - `/evolution`
  - `/skills`
  - `/pets`
  - `/backgrounds`
  - `/messages`
  - `/users`
  - `/admin`

`*.routes.js`

- Definir metodo, path, middleware y controlador.
- No ejecutar SQL.
- No contener reglas de negocio.

`*.controller.js`

- Leer `req.params`, `req.query`, `req.body`, `req.user`.
- Llamar al servicio correspondiente.
- Responder con formato estandar.

`*.service.js`

- Contener reglas de negocio.
- Coordinar repositorios.
- Abrir transacciones cuando una operacion modifique multiples tablas.
- Emitir eventos de dominio cuando corresponda.

`*.repository.js`

- Encapsular SQL.
- No conocer Express.
- Recibir `pool` o `client` transaccional.

`*.validators.js`

- Validar body, params y query.
- Recomendado: usar `zod` o una libreria equivalente para compartir contratos.

`middleware/errorHandler.js`

- Convertir errores conocidos a respuesta HTTP.
- Ocultar detalles internos en produccion.

`realtime/socketServer.js`

- Centralizar autenticacion de socket.
- Compartir validacion JWT con HTTP.
- Exponer funciones de emision por dominio, no `getIO()` global disperso.

## Arquitectura objetivo del frontend

### Estructura final propuesta

```txt
path-to-valhalla/frontend/
  package.json
  .env.example
  src/
    main.jsx
    app/
      App.jsx
      AppProviders.jsx
      routes.jsx
      routerGuards.jsx
    api/
      client.js
      ApiError.js
      endpoints.js
    config/
      env.js
    stores/
      sessionStore.js
      socketStore.js
      uiStore.js
    shared/
      components/
        Button.jsx
        Modal.jsx
        CurrencyAmount.jsx
        ItemTooltip.jsx
        LoadingState.jsx
        ErrorState.jsx
      hooks/
        useAuthToken.js
        useAsyncAction.js
      utils/
        currency.js
        assetUrl.js
      game/
        levelXp.js
    layout/
      GameLayout.jsx
      Sidebar.jsx
      TopBar.jsx
    features/
      auth/
        api/auth.api.js
        components/AuthForm.jsx
        pages/AuthPage.jsx
        hooks/useAuth.js
      onboarding/
        api/onboarding.api.js
        components/RaceSelection.jsx
        pages/RaceSelectionPage.jsx
      hero/
        api/hero.api.js
        components/
        hooks/useHeroProfile.js
        pages/HeroOverviewPage.jsx
      inventory/
        api/inventory.api.js
        components/
        hooks/useInventory.js
      packages/
        api/packages.api.js
        pages/PackagesPage.jsx
      shop/
        api/shop.api.js
        pages/MarketPage.jsx
      bank/
        api/bank.api.js
        pages/BankPage.jsx
      quests/
        api/quests.api.js
        pages/ValhallaHallPage.jsx
      expeditions/
        api/expeditions.api.js
        pages/ExpeditionsPage.jsx
      bestiary/
        api/bestiary.api.js
        pages/BestiaryPage.jsx
      evolution/
        api/evolution.api.js
        components/EvolutionModal.jsx
      skills/
        api/skills.api.js
        pages/GrimoirePage.jsx
      pets/
        api/pets.api.js
      backgrounds/
        api/backgrounds.api.js
      messages/
        api/messages.api.js
        pages/MessagingPage.jsx
        hooks/useMessages.js
      onix/
        components/OnixShopModal.jsx
    assets/
    styles/
      index.css
```

### Responsabilidades frontend

`api/client.js`

- Unico wrapper sobre `fetch`.
- Usa `VITE_API_BASE_URL`.
- Agrega `Authorization: Bearer <token>` cuando exista token.
- Parse JSON centralizado.
- Convierte errores HTTP a `ApiError`.
- Permite manejar `401` globalmente, limpiando sesion y redirigiendo a login.

Ejemplo conceptual:

```js
await apiClient.get('/auth/me');
await apiClient.post('/shop/purchases', { shopId, quantity });
await apiClient.patch(`/messages/${messageId}/read`);
```

`features/*/api/*.api.js`

- Define funciones del dominio.
- No conoce componentes.
- No lee directamente `localStorage`.

Ejemplo conceptual:

```js
export const shopApi = {
  getItems: () => apiClient.get('/shop/items'),
  refresh: () => apiClient.post('/shop/refresh'),
  buy: (payload) => apiClient.post('/shop/purchases', payload),
  sell: (payload) => apiClient.post('/shop/sales', payload),
};
```

`stores/sessionStore.js`

- Mantiene usuario autenticado, token y estado de sesion.
- Sincroniza con `localStorage` en un solo lugar.

`stores/socketStore.js`

- Crea y destruye la conexion Socket.IO.
- Escucha eventos globales, por ejemplo mensajes nuevos.

`features/*/hooks`

- Orquestan carga de datos, loading, errores y acciones.
- Recomendado: agregar `@tanstack/react-query` para cache, invalidacion y estados remotos.
- Si no se desea agregar esa dependencia, usar hooks propios con `useState/useEffect`, pero manteniendo las llamadas HTTP fuera de las paginas.

`pages`

- Componen layout y componentes del dominio.
- No deben construir URLs del backend ni repetir headers.

## Paquete compartido propuesto

Actualmente existen utilidades compartidas duplicadas entre backend y frontend, por ejemplo `level_xp.js`.

Estado final recomendado:

```txt
path-to-valhalla/
  backend/
  frontend/
  packages/
    shared/
      package.json
      src/
        game/
          levelXp.js
          playerStats.js
          xpRewards.js
        money/
          currency.js
        contracts/
          apiResponses.js
```

Uso esperado:

- Backend importa reglas puras desde `@path-to-valhalla/shared`.
- Frontend importa calculos puros desde `@path-to-valhalla/shared`.
- El paquete compartido no debe depender de Express, React, PostgreSQL ni APIs del navegador.
- Si se agregan validadores compartidos, usar una libreria compatible con Node y navegador.

Para soportarlo de forma limpia, conviene convertir el repo en workspace:

```txt
path-to-valhalla/
  package.json
  backend/package.json
  frontend/package.json
  packages/shared/package.json
```

## Formato de respuesta recomendado

Estandarizar respuestas reduce condicionales en frontend y facilita debugging.

Respuesta exitosa:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Respuesta de error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos invalidos.",
    "details": {}
  }
}
```

Regla de compatibilidad:

- Durante la migracion, los endpoints legacy pueden seguir devolviendo `{ success: true }`.
- Los endpoints nuevos `/api/v1` deben usar el formato estandar.
- El frontend nuevo debe consumir `/api/v1` y delegar el unwrap al `apiClient`.

## Cambios de endpoints

### Estrategia general

- Mantener endpoints actuales bajo `/api` temporalmente.
- Crear endpoints nuevos bajo `/api/v1`.
- Migrar frontend por dominio.
- Eliminar endpoints legacy cuando ya no existan consumidores.

### Tabla de migracion de endpoints

| Dominio | Endpoint actual | Problema actual | Endpoint final propuesto | Consumo frontend final |
|---|---|---|---|---|
| Auth | `POST /api/register` | Legacy directo en `server.js` | `POST /api/v1/auth/register` | `features/auth/api/auth.api.js -> register()` |
| Auth | `POST /api/login` | Legacy directo en `server.js` | `POST /api/v1/auth/login` | `features/auth/api/auth.api.js -> login()` |
| Auth | `POST /api/auth/register` | Duplicado con legacy | `POST /api/v1/auth/register` | Igual que arriba |
| Auth | `POST /api/auth/login` | Duplicado con legacy | `POST /api/v1/auth/login` | Igual que arriba |
| Auth | `GET /api/auth/profile` | Nombre mezclado con perfil de jugador | `GET /api/v1/auth/me` | `sessionStore.bootstrapSession()` |
| Hero | `POST /api/choose-race` | Recibe `userId` desde cliente y es legacy | `POST /api/v1/hero/race` | `features/onboarding/api/onboarding.api.js -> chooseRace()` |
| Hero | `POST /api/train-stats` | Recibe `userId` desde cliente | `POST /api/v1/hero/stats/train` | `features/hero/api/hero.api.js -> trainStats()` |
| Hero | `POST /api/rent-bag` | Recibe `userId` desde cliente | `POST /api/v1/hero/bags/rent` | `features/inventory/api/inventory.api.js -> rentBag()` |
| Hero | No existe uno dedicado | Perfil se obtiene desde auth | `GET /api/v1/hero/me` | `features/hero/hooks/useHeroProfile.js` |
| Skills | `GET /api/my-skills` | Legacy fuera de modulo | `GET /api/v1/skills` | `features/skills/api/skills.api.js -> getSkills()` |
| Skills | `POST /api/equip-skill` | Legacy fuera de modulo | `PATCH /api/v1/skills/:playerSkillId/equip` | `features/skills/api/skills.api.js -> toggleEquipSkill()` |
| Skills | `POST /api/skills/upgrade` | Accion versionable | `POST /api/v1/skills/:playerSkillId/upgrade` | `features/skills/api/skills.api.js -> upgradeSkill()` |
| Pets | `GET /api/my-pets` | Legacy fuera de modulo | `GET /api/v1/pets` | `features/pets/api/pets.api.js -> getPets()` |
| Pets | `POST /api/equip-pet` | Legacy fuera de modulo | `PATCH /api/v1/pets/:petId/equip` | `features/pets/api/pets.api.js -> equipPet()` |
| Pets | `POST /api/feed-pet` | Legacy fuera de modulo | `POST /api/v1/pets/:petId/feed` | `features/pets/api/pets.api.js -> feedPet()` |
| Backgrounds | `GET /api/backgrounds?userId=...` | `userId` via query | `GET /api/v1/backgrounds` | `features/backgrounds/api/backgrounds.api.js -> listBackgrounds()` |
| Backgrounds | `POST /api/equip-background` | `userId` via body | `PATCH /api/v1/backgrounds/:backgroundId/equip` | `features/backgrounds/api/backgrounds.api.js -> equipBackground()` |
| Backgrounds | `POST /api/buy-background` | `userId` via body | `POST /api/v1/backgrounds/:backgroundId/purchase` | `features/backgrounds/api/backgrounds.api.js -> buyBackground()` |
| Inventory | `POST /api/inventory/move` | Duplicado entre router y `server.js` | `PATCH /api/v1/inventory/items/:itemId/location` | `features/inventory/api/inventory.api.js -> moveItem()` |
| Inventory | `POST /api/inventory/organize` | Duplicado entre router y `server.js` | `POST /api/v1/inventory/organize` | `features/inventory/api/inventory.api.js -> organize()` |
| Inventory | `POST /api/inventory/use` | Contrato con `inventoryItemId` | `POST /api/v1/inventory/items/:itemId/use` | `features/inventory/api/inventory.api.js -> useItem()` |
| Packages | `GET /api/packages/my-packages?page=1` | Nombre redundante | `GET /api/v1/packages?page=1` | `features/packages/api/packages.api.js -> listPackages()` |
| Packages | `POST /api/packages/claim` | Body contiene `packageId` | `POST /api/v1/packages/:packageId/claim` | `features/packages/api/packages.api.js -> claimPackage()` |
| Shop | `GET /api/shop/items` | Correcto pero sin version | `GET /api/v1/shop/items` | `features/shop/api/shop.api.js -> getItems()` |
| Shop | `POST /api/shop/refresh` | Correcto pero sin version | `POST /api/v1/shop/refresh` | `features/shop/api/shop.api.js -> refresh()` |
| Shop | `POST /api/shop/buy` | Verbo en path | `POST /api/v1/shop/purchases` | `features/shop/api/shop.api.js -> buy()` |
| Shop | `POST /api/shop/sell` | Verbo en path | `POST /api/v1/shop/sales` | `features/shop/api/shop.api.js -> sell()` |
| Bank | `GET /api/bank/status` | `status` no aporta mucho | `GET /api/v1/bank` | `features/bank/api/bank.api.js -> getBank()` |
| Bank | `POST /api/bank/deposit` | Verbo directo aceptable, pero no consistente | `POST /api/v1/bank/deposits` | `features/bank/api/bank.api.js -> deposit()` |
| Bank | `POST /api/bank/withdraw` | Verbo directo aceptable, pero no consistente | `POST /api/v1/bank/withdrawals` | `features/bank/api/bank.api.js -> withdraw()` |
| Evolution | `GET /api/evolution/options` | Correcto pero sin version | `GET /api/v1/evolution/options` | `features/evolution/api/evolution.api.js -> getOptions()` |
| Evolution | `POST /api/evolution/start` | Correcto pero sin version | `POST /api/v1/evolution/start` | `features/evolution/api/evolution.api.js -> start()` |
| Expeditions | `GET /api/expeditions` | Correcto pero sin version | `GET /api/v1/expeditions` | `features/expeditions/api/expeditions.api.js -> listZones()` |
| Expeditions | `GET /api/expeditions/:zoneId/enemies` | Correcto pero sin version | `GET /api/v1/expeditions/:zoneId/enemies` | `features/expeditions/api/expeditions.api.js -> listEnemies()` |
| Expeditions | `POST /api/expeditions/start` | Accion de batalla poco explicita | `POST /api/v1/expeditions/battles` | `features/expeditions/api/expeditions.api.js -> startBattle()` |
| Bestiary | `GET /api/bestiary` | Reusa `expeditionController` | `GET /api/v1/bestiary` | `features/bestiary/api/bestiary.api.js -> listBestiary()` |
| Quests | `GET /api/quests/status?context=hall` | `status` agrupa varios casos | `GET /api/v1/quests?context=hall` | `features/quests/api/quests.api.js -> getQuestState()` |
| Quests | `POST /api/quests/accept` | Body contiene `questId` | `POST /api/v1/quests/:questId/accept` | `features/quests/api/quests.api.js -> acceptQuest()` |
| Quests | `POST /api/quests/complete` | Body contiene `playerQuestId` | `POST /api/v1/player-quests/:playerQuestId/complete` | `features/quests/api/quests.api.js -> completeQuest()` |
| Quests | `POST /api/quests/refresh` | Frontend lo llama, router actual no lo expone | `POST /api/v1/quests/refresh` | `features/quests/api/quests.api.js -> refreshBoard()` |
| Messages | `GET /api/messages/` | Slash final innecesario | `GET /api/v1/messages` | `features/messages/api/messages.api.js -> listMessages()` |
| Messages | `POST /api/messages/send` | Verbo en path | `POST /api/v1/messages` | `features/messages/api/messages.api.js -> sendMessage()` |
| Messages | `POST /api/messages/read` | Body contiene `messageId` | `PATCH /api/v1/messages/:messageId/read` | `features/messages/api/messages.api.js -> markAsRead()` |
| Messages | `GET /api/messages/unread` | Nombre ambiguo | `GET /api/v1/messages/unread-count` | `features/messages/api/messages.api.js -> getUnreadCount()` |
| Users | `GET /api/search-users?q=...` | Legacy fuera de modulo y sin auth clara | `GET /api/v1/users/search?q=...` | `features/messages/api/messages.api.js -> searchUsers()` |
| Admin | `POST /api/admin/give-item` | No se observa proteccion admin | `POST /api/v1/admin/inventory/items` | Solo panel admin o scripts autorizados |

## Contrato de autenticacion

Estado actual:

- El frontend usa `Authorization: Bearer <token>` en algunos lugares.
- Tambien usa `x-auth-token` en otros.
- El middleware acepta ambos.
- Algunas rutas no usan token y reciben `userId` desde frontend.

Estado final:

- Cliente envia siempre:

```txt
Authorization: Bearer <token>
```

- Backend sigue aceptando temporalmente `x-auth-token` durante migracion, pero se marca como deprecated.
- Todas las operaciones del usuario autenticado derivan `playerId` desde `req.user.id`.
- Ninguna accion sensible acepta `userId` desde body o query.
- Socket.IO usa el mismo token JWT:

```js
io(API_BASE_URL, {
  auth: { token }
});
```

## Contrato de Socket.IO

Estado actual:

- `frontend/src/App.jsx` crea socket.
- `backend/src/socket.js` autentica JWT con clave hardcodeada.
- Mensajes emiten evento `new_message`.

Estado final propuesto:

Backend:

```txt
src/realtime/socketServer.js
src/modules/messages/messages.events.js
```

Eventos recomendados:

| Evento | Direccion | Payload |
|---|---|---|
| `message:new` | Backend -> Frontend | `{ message }` |
| `message:read` | Backend -> Frontend | `{ messageId }` |
| `messages:unread-count` | Backend -> Frontend | `{ count }` |
| `socket:error` | Backend -> Frontend | `{ code, message }` |

Frontend:

- `socketStore` inicializa conexion cuando hay token.
- `features/messages/hooks/useMessages.js` se suscribe a eventos del store.
- `App.jsx` deja de conocer detalles de eventos de mensajeria.

## Fases para completar con exito la reestructuracion

La reestructuracion debe hacerse por fases, no como una reescritura completa. Cada fase debe dejar el sistema en un estado ejecutable, verificable y con un criterio claro de salida antes de pasar a la siguiente.

### Resumen ejecutivo de fases

| Fase | Nombre | Proposito | Depende de | Criterio de salida |
|---|---|---|---|---|
| 0 | Inventario y baseline | Congelar el mapa actual de rutas, dependencias y flujos criticos | Ninguna | Hay checklist de flujos actuales y mapa de endpoints/consumidores |
| 1 | Infraestructura backend | Separar bootstrap, configuracion, DB, seguridad y errores globales | Fase 0 | Backend arranca igual, pero sin secretos hardcodeados y con error handler central |
| 2 | API versionada | Crear `/api/v1` en paralelo a `/api` sin romper frontend actual | Fase 1 | Existen routers versionados y compatibilidad legacy temporal |
| 3 | Modularizacion backend | Migrar controladores monoliticos a modulos por dominio | Fase 2 | Cada dominio migrado tiene routes/controller/service/repository/validators |
| 4 | Migraciones de DB | Reemplazar schema disperso y cambios runtime por migraciones reproducibles | Fase 1 | La base puede reconstruirse desde migraciones y seeds |
| 5 | Cliente HTTP frontend | Centralizar consumo del backend y autenticacion | Fase 2 | No hay nuevos `fetch` fuera de `src/api` o `features/*/api` |
| 6 | Estado, sesion y socket frontend | Sacar sesion/socket de `App.jsx` y centralizar lifecycle | Fase 5 | Login/logout/socket funcionan desde stores/hooks dedicados |
| 7 | Migracion por features frontend | Mover paginas y componentes a carpetas por dominio | Fases 5 y 6 | Cada feature consume su API propia y no arma endpoints manualmente |
| 8 | Paquete shared | Unificar reglas puras compartidas entre backend y frontend | Fases 3 y 7 | Calculos compartidos tienen una sola fuente |
| 9 | Limpieza legacy | Eliminar endpoints, archivos y duplicados ya reemplazados | Fases 3, 7 y 8 | No quedan consumidores de `/api` legacy ni archivos obsoletos |
| 10 | Validacion final y estabilizacion | Confirmar que la reestructuracion esta completa y lista para seguir desarrollando | Fase 9 | Smoke tests, build, lint y checklist funcional pasan |

### Checklist de estado de fases

Leyenda:

- `[x]` fase completada.
- `[ ]` fase pendiente.
- Si una fase esta en progreso, dejarla sin marcar y agregar `Estado: en progreso` en la linea correspondiente.

Estado inicial: la reestructuracion aun no ha sido ejecutada. El plan esta documentado, pero las fases tecnicas siguen pendientes hasta que se implementen y verifiquen sus criterios de salida.

- [ ] Fase 0: Inventario y baseline. Estado: pendiente.
- [ ] Fase 1: Infraestructura backend. Estado: pendiente.
- [ ] Fase 2: API versionada. Estado: pendiente.
- [ ] Fase 3: Modularizacion backend. Estado: pendiente.
- [ ] Fase 4: Migraciones de DB. Estado: pendiente.
- [ ] Fase 5: Cliente HTTP frontend. Estado: pendiente.
- [ ] Fase 6: Estado, sesion y socket frontend. Estado: pendiente.
- [ ] Fase 7: Migracion por features frontend. Estado: pendiente.
- [ ] Fase 8: Paquete shared. Estado: pendiente.
- [ ] Fase 9: Limpieza legacy. Estado: pendiente.
- [ ] Fase 10: Validacion final y estabilizacion. Estado: pendiente.
### Reglas de avance entre fases

- No iniciar una fase si la anterior no tiene criterio de salida cumplido.
- No eliminar endpoints legacy hasta que el frontend ya consuma `/api/v1`.
- No mover un dominio frontend si su API backend nueva no existe o no tiene adaptador temporal.
- No aceptar `userId` desde el cliente en ningun endpoint nuevo autenticado.
- No mezclar refactors esteticos con la migracion arquitectonica.
- Cada fase debe terminar con verificacion manual o automatizada.

### Puertas de control obligatorias

Antes de cerrar una fase se debe confirmar:

- El proyecto sigue arrancando en local.
- El flujo funcional relacionado con la fase fue probado.
- No se dejaron endpoints duplicados sin documentar.
- No se introdujeron nuevas llamadas directas a `fetch` fuera de la capa API del frontend.
- No se agregaron secretos, credenciales o datos locales al codigo fuente.
- Los cambios quedaron documentados en este plan o en notas tecnicas del dominio.

## Plan detallado por fase

### Fase 0: Inventario tecnico y baseline

Objetivo: dejar claro que se va a cambiar y como verificar que no se rompio.

Tareas:

- Documentar endpoints actuales y consumidores frontend.
- Agregar `.env.example` para backend y frontend.
- Definir formato de respuesta nuevo.
- Definir convencion de nombres por dominio.
- Identificar rutas legacy que deben mantenerse temporalmente.
- Crear checklist de smoke tests manuales:
  - Registro.
  - Login.
  - Seleccion de raza.
  - Carga de perfil.
  - Inventario mover/organizar/usar.
  - Paquetes listar/reclamar.
  - Mercado comprar/vender/refrescar.
  - Banco depositar/retirar.
  - Expediciones listar/iniciar combate.
  - Misiones aceptar/completar/refrescar.
  - Mensajes enviar/leer/contador/socket.

Resultado esperado:

- Mapa completo de contratos actuales.
- Criterios de aceptacion antes de mover codigo.

### Fase 1: Infraestructura backend

Objetivo: separar arranque, configuracion y manejo global.

Tareas:

- Crear `src/app.js`.
- Reducir `server.js` a bootstrap.
- Crear `src/config/env.js` con validacion de variables:
  - `NODE_ENV`
  - `PORT`
  - `DATABASE_URL` o `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
  - `JWT_SECRET`
  - `CORS_ORIGIN`
- Reemplazar credenciales hardcodeadas en `src/config/db.js`.
- Mover `db.js` a `src/db/pool.js`.
- Crear `src/middleware/errorHandler.js`.
- Crear `src/middleware/notFound.js`.
- Aplicar `helmet`.
- Configurar CORS desde env.
- Crear `src/lib/ApiError.js`.
- Crear `src/lib/asyncHandler.js`.

Resultado esperado:

- Backend inicia igual que antes, pero con configuracion limpia.
- Errores se responden desde un unico middleware.
- No hay secretos hardcodeados.

### Fase 2: API versionada y compatibilidad

Objetivo: introducir `/api/v1` sin romper el frontend actual.

Tareas:

- Crear `src/api/v1/router.js`.
- Montar `app.use('/api/v1', v1Router)`.
- Mantener `app.use('/api', legacyRouter)` o los endpoints antiguos temporalmente.
- Crear adaptadores legacy si hace falta:
  - `/api/login` llama internamente al servicio nuevo de auth.
  - `/api/register` llama internamente al servicio nuevo de auth.
- Agregar logs o comentarios de deprecacion para endpoints legacy.
- Corregir exposicion faltante de refresh de quests en la nueva API.

Resultado esperado:

- El frontend actual sigue funcionando con `/api`.
- Los nuevos dominios pueden migrarse uno por uno a `/api/v1`.

### Fase 3: Modularizacion backend por dominio

Objetivo: llenar `src/modules` con implementacion real y retirar controladores monoliticos gradualmente.

Orden recomendado:

1. `auth`
2. `hero`
3. `inventory`
4. `packages`
5. `shop`
6. `bank`
7. `quests`
8. `expeditions`
9. `bestiary`
10. `evolution`
11. `skills`
12. `pets`
13. `backgrounds`
14. `messages`
15. `users`
16. `admin`

Para cada dominio:

- Crear `*.routes.js`.
- Crear `*.controller.js`.
- Extraer reglas a `*.service.js`.
- Extraer SQL a `*.repository.js`.
- Crear `*.validators.js`.
- Montar en `api/v1/router.js`.
- Mantener endpoint legacy llamando al servicio nuevo hasta que frontend migre.
- Agregar pruebas del servicio o del endpoint critico.

Resultado esperado:

- Los controladores actuales quedan vacios o eliminados al final.
- Las rutas legacy desaparecen al final de la migracion.
- El backend queda organizado por dominio.

### Fase 4: Base de datos y migraciones

Objetivo: eliminar SQL disperso y cambios de schema en runtime.

Tareas:

- Elegir herramienta de migraciones:
  - Opcion simple: `node-pg-migrate`.
  - Opcion alternativa: migraciones SQL manuales con scripts propios.
- Crear `src/db/migrations`.
- Convertir `sql/messages_schema.sql` y `scripts/init_db.js` en una migracion versionada.
- Mover cualquier `ALTER TABLE` ejecutado dentro de controladores a migraciones.
- Eliminar logica tipo `ensureBankColumns` de controladores.
- Crear seeds para datos base del juego si aplica:
  - clases
  - skills
  - backgrounds
  - items templates
  - quests
  - zonas/enemigos
- Agregar scripts:

```json
{
  "db:migrate": "...",
  "db:rollback": "...",
  "db:seed": "..."
}
```

Resultado esperado:

- El schema se reproduce desde cero.
- El backend no modifica estructura de tablas durante requests normales.
- Desarrollo y produccion usan el mismo flujo de migraciones.

### Fase 5: Cliente HTTP frontend

Objetivo: eliminar `fetch` disperso.

Tareas:

- Crear `src/api/client.js`.
- Crear `src/api/ApiError.js`.
- Crear `src/config/env.js`.
- Reemplazar `src/constants/api.js` o convertirlo en wrapper temporal.
- Centralizar headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- Implementar manejo global de:
  - `401`: cerrar sesion.
  - `403`: mostrar error de permisos.
  - `500`: mostrar error generico.
- Crear servicios por dominio en `features/*/api`.
- Migrar `messageService.js` a `features/messages/api/messages.api.js`.

Resultado esperado:

- Ninguna pagina construye URLs manualmente.
- Ninguna pagina lee token directamente de `localStorage`.
- Los errores del backend se procesan de forma consistente.

### Fase 6: Estado frontend y rutas

Objetivo: separar sesion, socket, rutas y UI.

Tareas:

- Crear `src/app/routes.jsx`.
- Crear `src/app/AppProviders.jsx`.
- Crear `stores/sessionStore.js`.
- Crear `stores/socketStore.js`.
- Mover la logica de sesion desde `App.jsx` a `sessionStore` o `useAuth`.
- Mover la logica de socket desde `App.jsx` a `socketStore`.
- Mover contador de mensajes a `features/messages/hooks/useUnreadCount`.
- Convertir `App.jsx` en composicion de providers y rutas.

Resultado esperado:

- `App.jsx` queda pequeno y predecible.
- El logout destruye socket y limpia sesion en un solo flujo.
- Las rutas se entienden sin leer logica de negocio.

### Fase 7: Features frontend

Objetivo: mover paginas/componentes a carpetas por dominio.

Orden recomendado:

1. `auth`
2. `onboarding`
3. `hero`
4. `inventory`
5. `packages`
6. `shop`
7. `bank`
8. `quests`
9. `expeditions`
10. `bestiary`
11. `evolution`
12. `skills`
13. `pets`
14. `backgrounds`
15. `messages`

Para cada feature:

- Mover pagina a `features/<dominio>/pages`.
- Mover componentes especificos a `features/<dominio>/components`.
- Crear `features/<dominio>/api`.
- Crear hooks del dominio.
- Eliminar llamadas directas a `fetch`.
- Eliminar lecturas directas de `localStorage`.
- Sustituir props muy amplias por datos/hook especifico cuando aplique.

Resultado esperado:

- Cada feature puede evolucionar con menos impacto lateral.
- La UI no depende directamente de endpoints.

### Fase 8: Paquete compartido

Objetivo: eliminar duplicacion de reglas puras.

Tareas:

- Crear `packages/shared`.
- Mover `level_xp` a `packages/shared/src/game/levelXp.js`.
- Evaluar mover:
  - `xp_rewards`
  - calculos de stats puros
  - utilidades de moneda
  - contratos de respuestas
- Configurar workspaces.
- Actualizar imports de backend y frontend.

Resultado esperado:

- Una sola fuente para reglas puras compartidas.
- Menos riesgo de divergencia entre frontend y backend.

### Fase 9: Limpieza legacy

Objetivo: retirar compatibilidad antigua.

Tareas:

- Confirmar que frontend no consume ningun endpoint `/api` legacy.
- Eliminar endpoints directos de `server.js`.
- Eliminar controladores antiguos reemplazados por modulos.
- Eliminar `Dashboard_old.jsx` o moverlo a una carpeta `legacy/` si aun se necesita como referencia.
- Eliminar `frontend/src/constants/api.js` si ya existe `src/api/client.js`.
- Eliminar duplicados de `shared`.
- Verificar que `rg "/api/" frontend/src` solo apunte a servicios centralizados o constantes de API.

Resultado esperado:

- El repo no conserva codigo muerto de la migracion.
- La arquitectura final queda clara para nuevas features.

### Fase 10: Validacion final y estabilizacion

Objetivo: confirmar que la reestructuracion esta completa, que los flujos principales siguen funcionando y que el equipo puede seguir desarrollando sobre la nueva arquitectura sin depender de rutas o archivos legacy.

Tareas:

- Ejecutar verificacion automatizada disponible:
  - `npm run lint` en frontend.
  - `npm run build` en frontend.
  - pruebas backend si fueron agregadas durante la migracion.
  - pruebas frontend si fueron agregadas durante la migracion.
- Levantar backend y frontend en local con variables `.env` limpias.
- Ejecutar smoke tests manuales de los flujos criticos:
  - registro e inicio de sesion.
  - seleccion de raza.
  - carga de perfil.
  - entrenamiento de stats.
  - uso, movimiento y organizacion de inventario.
  - reclamo de paquetes.
  - compra, venta y refresh de tienda.
  - deposito y retiro del banco.
  - listado e inicio de expediciones.
  - aceptacion, refresh y completado de misiones.
  - envio, lectura, contador y notificacion socket de mensajes.
- Confirmar que no quedan consumidores legacy:
  - `rg "/api/" path-to-valhalla/frontend/src`
  - `rg "localStorage.getItem('token')" path-to-valhalla/frontend/src`
  - `rg "userId" path-to-valhalla/frontend/src`
- Confirmar que los endpoints legacy fueron eliminados o marcados con fecha de retiro si se decide conservarlos temporalmente.
- Revisar que `.env.example` este actualizado para backend y frontend.
- Revisar que las migraciones permitan reconstruir el schema necesario.
- Revisar que el paquete compartido no importe codigo especifico de React, Express, PostgreSQL ni APIs del navegador.
- Actualizar este documento con cualquier decision final que haya cambiado durante la ejecucion.

Resultado esperado:

- La aplicacion corre localmente usando la arquitectura nueva.
- El frontend consume `/api/v1` mediante servicios centralizados.
- El backend responde con modulos versionados y sin secretos hardcodeados.
- Los flujos principales fueron verificados.
- La deuda legacy queda eliminada o explicitamente documentada.

Criterios de aceptacion:

- `server.js` solo hace bootstrap del servidor.
- `App.jsx` solo compone providers/rutas y no gestiona detalles de socket o fetch.
- No hay llamadas HTTP directas desde paginas o componentes.
- No hay payloads autenticados que dependan de `userId` enviado por el cliente.
- Los comandos de verificacion acordados pasan o tienen una incidencia documentada.
- El equipo puede agregar una nueva feature siguiendo el patron de modulo backend y feature frontend sin tocar codigo legacy.
## Cambios tecnicos detallados por dominio

### Auth

Cambios backend:

- `auth.service.js` gestiona registro, login y generacion de token.
- `auth.repository.js` contiene queries de players necesarias para autenticacion.
- `auth.controller.js` solo traduce HTTP.
- Usar `JWT_SECRET` desde env.
- `GET /auth/me` retorna usuario autenticado basico o perfil minimo de sesion.

Cambios frontend:

- `Auth.jsx` se divide en `AuthPage` y `AuthForm`.
- `useAuth` hace `login`, `register`, `logout`, `bootstrapSession`.
- Token se persiste solo desde `sessionStore`.

### Hero

Cambios backend:

- Mover `chooseRace`, `trainStats`, `rentBag` desde `playerController` a `hero` o `inventory` segun corresponda.
- No recibir `userId` desde body.
- `hero.service.js` usa `playerId` desde JWT.
- `hero.repository.js` expone queries de perfil, stats, inventario resumido y bolsas.

Cambios frontend:

- `HeroOverview` consume `heroApi.getMe`, `heroApi.trainStats`.
- `RaceSelection` consume `onboardingApi.chooseRace`.
- Componentes de inventario usados dentro de hero se extraen a `features/inventory/components`.

### Inventory y Packages

Cambios backend:

- Separar inventario real (`player_items`) de paquetes pendientes (`player_packages`).
- `inventory.service.js` maneja mover, organizar y usar item.
- `packages.service.js` maneja listar y reclamar paquetes.
- Todas las operaciones que modifican multiples tablas usan transaccion.
- El item/package id viaja en params cuando identifica un recurso.

Cambios frontend:

- `PackagesPage` usa `packagesApi.list` y `packagesApi.claim`.
- Drag and drop llama a `claimPackage(packageId, { targetSlot })`.
- `HeroOverview` y `PackagesPage` comparten componentes de bolsa/slots desde `features/inventory/components`.

### Shop

Cambios backend:

- `shop.service.js` maneja stock, refresh, compra y venta.
- `shop.repository.js` encapsula queries de stock, players, items.
- `POST /shop/purchases` reemplaza `POST /shop/buy`.
- `POST /shop/sales` reemplaza `POST /shop/sell`.

Cambios frontend:

- `MarketPage` deja de llamar `fetch`.
- `shopApi` expone `getItems`, `refresh`, `buy`, `sell`.
- Al comprar/vender, invalidar perfil/inventario/stock segun respuesta.

### Bank

Cambios backend:

- `GET /bank` reemplaza `/bank/status`.
- Depositos y retiros son transacciones.
- Validar moneda y monto en validator, no en controller.
- Las columnas de banco deben existir por migracion, no por runtime.

Cambios frontend:

- `BankPage` consume `bankApi.getBank`, `bankApi.deposit`, `bankApi.withdraw`.
- Reutilizar utilidades de moneda compartidas.

### Quests y Evolution

Cambios backend:

- `quests.routes.js` debe exponer refresh board.
- `quests.service.js` separa:
  - estado de tablero
  - aceptar quest
  - completar player quest
  - refresh de tablero
- Evolution puede depender de quest service, pero no debe duplicar reglas de quests.

Cambios frontend:

- `ValhallaHallPage` consume `questsApi`.
- `EvolutionModal` consume `evolutionApi` y `questsApi.completePlayerQuest`.
- Evitar query cache-busting con `?t=Date.now()` si se adopta cache invalidation.

### Expeditions y Bestiary

Cambios backend:

- `bestiary` no deberia depender directamente de `expeditionController`.
- Compartir repositorios o servicios internos si usan las mismas tablas.
- La creacion de batalla se expresa como `POST /expeditions/battles`.

Cambios frontend:

- `ExpeditionsPage` consume `expeditionsApi`.
- `BestiaryPage` consume `bestiaryApi`.
- Componentes visuales de enemigo/resultado se comparten donde tenga sentido.

### Messages y realtime

Cambios backend:

- `messages.service.js` guarda mensaje y emite evento mediante `messages.events.js`.
- `messages.repository.js` contiene queries de mensajes.
- `users` provee busqueda de usuarios.
- Socket deja de depender de secret hardcodeado.
- Evento `new_message` se reemplaza gradualmente por `message:new`.

Cambios frontend:

- `messages.api.js` reemplaza `messageService.js`.
- `useMessages` agrupa conversaciones y expone acciones.
- `socketStore` actualiza contador y cache de mensajes.
- `MessagingPage` se enfoca en render y handlers de UI.

### Admin

Cambios backend:

- `POST /api/admin/give-item` debe moverse a `/api/v1/admin/inventory/items`.
- Requiere `requireAuth` y `requireAdmin`.
- Registrar auditoria minima: admin, player destino, item, fecha.

Cambios frontend:

- No debe consumirse desde UI normal.
- Si se crea panel admin, debe vivir en feature propia.

## Variables de entorno esperadas

### Backend `.env.example`

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgres://postgres:postgres@localhost:5432/path-to-valhalla
# Alternativa si no se usa DATABASE_URL:
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=path-to-valhalla
# PGUSER=postgres
# PGPASSWORD=postgres

JWT_SECRET=replace-me
JWT_EXPIRES_IN=7d
```

### Frontend `.env.example`

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

Nota: Si `VITE_API_BASE_URL` ya incluye `/api/v1`, el `apiClient` debe recibir paths como `/auth/login`, no `/api/v1/auth/login`.

## Pruebas recomendadas

### Backend

Agregar:

- `vitest` o `jest`.
- `supertest` para endpoints.
- Base de datos de test aislada.

Pruebas minimas:

- Auth:
  - Registro exitoso.
  - Login exitoso.
  - Login con credenciales invalidas.
  - `GET /auth/me` sin token retorna 401.
- Inventory:
  - Mover item valida pertenencia.
  - Organizar no toca items equipados.
  - Usar item valida tipo y actualiza inventario.
- Packages:
  - Reclamar paquete crea item o incrementa stack.
  - Reclamar paquete ajeno retorna 404.
- Shop:
  - Compra descuenta moneda y agrega item.
  - Venta agrega moneda y reduce item.
- Bank:
  - Deposito sin saldo falla.
  - Retiro sin saldo bancario falla.
- Messages:
  - Enviar mensaje crea registro.
  - Marcar como leido solo permite destinatario.

### Frontend

Agregar:

- `vitest`.
- `@testing-library/react`.
- Opcional: Playwright para flujos criticos.
- Si se agrega TanStack Query, usar providers de test.

Pruebas minimas:

- `apiClient` agrega token.
- `apiClient` convierte errores HTTP en `ApiError`.
- `sessionStore` persiste y limpia sesion.
- `AuthPage` llama `login/register`.
- `BankPage` renderiza saldos y envia transacciones.
- `MessagingPage` reacciona a evento `message:new`.

## Criterios de aceptacion del estado final

Backend:

- `server.js` solo arranca el servidor.
- `src/app.js` contiene configuracion Express.
- Todos los endpoints nuevos viven bajo `/api/v1`.
- No quedan secretos ni credenciales hardcodeadas.
- No hay acciones de usuario que acepten `userId` desde frontend.
- Los modulos tienen rutas, controladores, servicios y repositorios.
- Los errores se manejan con middleware central.
- Las migraciones reproducen el schema necesario.
- Socket.IO comparte autenticacion con HTTP.

Frontend:

- `App.jsx` no maneja reglas de sesion ni detalles de socket.
- Las llamadas HTTP estan centralizadas en `src/api` y `features/*/api`.
- Las paginas no usan `fetch` directamente.
- Las paginas no leen token directamente desde `localStorage`.
- Cada dominio tiene carpeta propia bajo `features`.
- El codigo compartido vive en `shared` o `packages/shared`.
- No quedan imports a endpoints legacy.

Integracion:

- `rg "/api/" path-to-valhalla/frontend/src` solo encuentra referencias en `src/api` o archivos `*.api.js`.
- `rg "localStorage.getItem('token')" path-to-valhalla/frontend/src` solo encuentra una referencia centralizada, idealmente en `sessionStore` o helper de storage.
- `rg "userId" path-to-valhalla/frontend/src` no aparece en payloads de acciones autenticadas.
- Todos los flujos principales funcionan contra `/api/v1`.

## Orden de ejecucion recomendado

1. Crear infraestructura backend (`app.js`, env, error handler).
2. Crear `/api/v1` paralelo a `/api`.
3. Migrar auth.
4. Crear cliente HTTP frontend.
5. Migrar sesion frontend.
6. Migrar dominio messages por ser el unico servicio parcialmente centralizado.
7. Migrar hero/onboarding.
8. Migrar inventory/packages.
9. Migrar shop/bank.
10. Migrar quests/evolution.
11. Migrar expeditions/bestiary.
12. Migrar skills/pets/backgrounds.
13. Crear paquete shared.
14. Agregar migraciones completas.
15. Eliminar endpoints legacy y codigo viejo.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Romper frontend al cambiar endpoints | Alto | Mantener `/api` legacy mientras se migra a `/api/v1` |
| Divergencia entre respuestas nuevas y viejas | Medio | `apiClient` adapta respuestas y se migran dominios completos |
| Reglas de negocio escondidas en componentes | Medio | Migrar por feature y extraer hooks/API antes de tocar UI |
| Transacciones incompletas en operaciones monetarias/inventario | Alto | Extraer servicios con helper transaccional y pruebas |
| Secretos expuestos en repo | Alto | Mover a `.env`, agregar `.env.example`, asegurar `.gitignore` |
| Socket desconectado tras logout/login | Medio | Centralizar lifecycle en `socketStore` |
| Migracion demasiado grande | Alto | Ejecutar por dominios, con compatibilidad temporal |

## Estado final esperado

Al terminar la reestructuracion, el sistema deberia quedar asi:

- Backend modular, versionado, seguro y testeable.
- Frontend organizado por features, con consumo HTTP centralizado.
- Contratos de API claros y faciles de evolucionar.
- Socket.IO desacoplado de `App.jsx` y del controlador de mensajes.
- Reglas compartidas puras en un paquete comun.
- Configuracion sensible fuera del codigo fuente.
- Migraciones de base de datos reproducibles.
- Menos duplicacion y menos dependencia entre dominios.

