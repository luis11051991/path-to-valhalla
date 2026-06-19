# API Compatibility — Legacy (`/api`) vs Versioned (`/api/v1`)

## Overview

The backend serves two layers of endpoints during the migration period:

| Layer | Base path | Status | Purpose |
|-------|-----------|--------|---------|
| **v1** | `/api/v1` | NEW — primary interface | All new domains, versioned, structured with routes/controller/service/repository. |
| **Legacy** | `/api` | DEPRECATED — kept for compatibility | Endpoints still consumed by the current frontend during migration. Direct legacy controller endpoints log a `[DEPRECATED]` warning to console. |

## Migration Map

### Routes module layer (express routers)

These mount directly under `/api/...` and are shared between both layers:

| Legacy path | v1 path | Status |
|-------------|---------|--------|
| `POST /api/auth/*` | `POST /api/v1/auth/*` | compat kept |
| `GET /api/evolution/*` | `GET /api/v1/evolution/*` | compat kept |
| `GET /api/expeditions/*` | `GET /api/v1/expeditions/*` | compat kept |
| `GET /api/packages/*` | `GET /api/v1/packages/*` | compat kept |
| `GET /api/shop/*` | `GET /api/v1/shop/*` | compat kept |
| `GET /api/workshop/*` | `GET /api/v1/workshop/*` | compat kept |
| `GET /api/inventory/*` | `GET /api/v1/inventory/*` | compat kept (routes shared) |
| `GET /api/quests/*` | `GET /api/v1/quests/*` | compat kept |
| `GET /api/bank/*` | `GET /api/v1/bank/*` | compat kept |
| `GET /api/bestiary/*` | `GET /api/v1/bestiary/*` | compat kept |
| `GET /api/messages/*` | `GET /api/v1/messages/*` | compat kept |

### Quest refresh endpoints (special case)

The current frontend calls `POST /api/quests/refresh` from `ValhallaHall.jsx`. Both layers expose this endpoint:

| Legacy path | v1 path | Auth | Implementation |
|-------------|---------|------|----------------|
| `POST /api/quests/refresh` | `POST /api/v1/quests/refresh` | `authMiddleware` | `questController.refreshBoard` |

Both routes are verified as wired at runtime:
- Legacy: `questRoutes.js` exports `router.post('/refresh', authMiddleware, refreshBoard)`.
- v1: `src/api/v1/router.js` mounts `questRoutes` under `/quests`, and its own `questRoutes.js` also has the refresh route.

### Notes on router file layout

The module layer uses two files for consistency with the task specification (`004_api_v1_compatibilidad`):
- `src/api/v1/index.js` — re-exports `router.js`. Mounting target in `app.js` uses this file.
- `src/api/v1/router.js` — source-of-truth router definition (explicit domain routes).

This equivalence is intentional: `index.js === require('./router')`, so any existing `require('./api/v1')` import or direct `require('./api/v1/router')` works identically.

### Individual legacy endpoints (direct controllers, no router)

| Legacy Endpoint | Recommended v1 Replacement | Domain |
|-----------------|----------------------------|--------|
| `POST /api/register` | `POST /api/v1/auth/register` | auth |
| `POST /api/login` | `POST /api/v1/auth/login` | auth |
| `POST /api/choose-race` | `POST /api/v1/hero` (new) | hero |
| `POST /api/train-stats` | `POST /api/v1/hero/stats` (new) | hero |
| `POST /api/rent-bag` | `POST /api/v1/inventory/bank` (new) | inventory |
| `GET /api/my-skills` | `GET /api/v1/hero/skills` (new) | skills |
| `POST /api/equip-skill` | `POST /api/v1/hero/skills/equip` (new) | skills |
| `POST /api/skills/upgrade` | `POST /api/v1/hero/skills/upgrade` (new) | skills |
| `GET /api/my-pets` | `GET /api/v1/pets` (new) | pets |
| `POST /api/equip-pet` | `POST /api/v1/pets/equip` (new) | pets |
| `POST /api/feed-pet` | `POST /api/v1/pets/feed` (new) | pets |
| `GET /api/backgrounds` | `GET /api/v1/backgrounds` (new) | backgrounds |
| `POST /api/equip-background` | `POST /api/v1/backgrounds/equip` (new) | backgrounds |
| `POST /api/buy-background` | `POST /api/v1/backgrounds/buy` (new) | backgrounds |
| `POST /api/inventory/move` | `POST /api/v1/inventory/move` (new) | inventory |
| `POST /api/inventory/organize` | `POST /api/v1/inventory/organize` (new) | inventory |
| `POST /api/admin/give-item` | admin panel v1 (new) | admin |
| `GET /api/search-users` | admin panel v1 (new) | admin |

## Notes

- Direct legacy controller endpoints pass through a `[DEPRECATED]` warning logger before the controller runs. Legacy router modules under `/api/<domain>` remain mounted for compatibility.
- Legacy endpoints must be removed **only after** the frontend is fully migrated to `/api/v1`.
- The `questRoutes.js` module already exposes the missing `/quests/refresh` endpoint in both layers.
- No breaking changes were made — the current frontend continues to work without modifications using this task.

## Files Modified in This Task (004)

| File | Change |
|------|--------|
| `src/app.js` | Mounted `/api/v1`, renamed route imports with `Legacy` suffix, added `[DEPRECATED]` middleware wrapping direct legacy controller endpoints. |
| `src/api/v1/router.js` | Created source-of-truth v1 router and mounted domain routers. |
| `src/api/v1/index.js` | Re-exports `router.js` to keep existing `require('./api/v1')` imports working. |
| `src/routes/questRoutes.js` | Added `POST /refresh` legacy route using `authMiddleware` and `questController.refreshBoard`. |
| `src/controllers/authController.js` | Uses centralized `env.JWT_SECRET` for issued JWTs. |
| `src/middleware/authMiddleware.js` | Uses centralized `env.JWT_SECRET` for HTTP token verification. |
| `src/socket.js` | Uses centralized `env.JWT_SECRET` for Socket.IO token verification. |
| `docs/API_COMPATIBILITY.md` | Created/updated migration map, quest refresh compatibility notes, router layout, and verification reference. |
