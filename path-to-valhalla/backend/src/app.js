const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// Rutas de compatibilidad legacy (mantener mientras frontend anterior las consume)
const authRoutesLegacy = require('./routes/authRoutes');
const evolutionRoutesLegacy = require('./routes/evolutionRoutes');
const expeditionRoutesLegacy = require('./routes/expeditionRoutes');
const packageRoutesLegacy = require('./routes/packageRoutes');
const shopRoutesLegacy = require('./routes/shopRoutes');
const workshopRoutesLegacy = require('./routes/workshopRoutes');
const inventoryRoutesLegacy = require('./routes/inventoryRoutes');
const questRoutesLegacy = require('./routes/questRoutes');
const bankRoutesLegacy = require('./routes/bankRoutes');
const bestiaryRoutesLegacy = require('./routes/bestiaryRoutes');
const messageRoutesLegacy = require('./routes/messageRoutes');

// --- Rutas v1 (nuevas, versionadas) ---
const apiV1Router = require('./api/v1');

function createApp() {
  const app = express();

  // Seguridad y parseo
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- SALUD / INFRAESTRUCTURA ---
  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, environment: env.NODE_ENV });
  });

  // ============================================================
  // API v1 — nueva interfaz versionada
  // Montar ANTES que /api legacy para evitar conflicto de prefijo.
  // ============================================================
  app.use('/api/v1', apiV1Router);

  // --- RUTAS NUEVAS (Router) ---
  app.use('/api/auth', authRoutesLegacy);
  app.use('/api/evolution', evolutionRoutesLegacy);
  app.use('/api/expeditions', expeditionRoutesLegacy);
  app.use('/api/packages', packageRoutesLegacy);
  app.use('/api/shop', shopRoutesLegacy);
  app.use('/api/workshop', workshopRoutesLegacy);
  app.use('/api/inventory', inventoryRoutesLegacy);
  app.use('/api/quests', questRoutesLegacy);
  app.use('/api/bank', bankRoutesLegacy);
  app.use('/api/bestiary', bestiaryRoutesLegacy);
  app.use('/api/messages', messageRoutesLegacy);

  // ============================================================
  // ENDPOINTS LEGACY — deprecatos, mantener para compatibilidad.
  // Eliminar solo tras migracion completa del frontend a /api/v1.
  // ============================================================

  // --- AUTH (legacy) ---
  const authController = require('./controllers/authController');
  app.post('/api/register', (_req, _res, next) => {
    console.warn('[DEPRECATED] POST /api/register — usar POST /api/v1/auth/register');
    next();
  }, authController.register);

  app.post('/api/login', (_req, _res, next) => {
    console.warn('[DEPRECATED] POST /api/login — usar POST /api/v1/auth/login');
    next();
  }, authController.login);

  // Helper para log de deprecated genérico
  const deprecate = (msg) => (_req, _res, next) => {
    console.warn(`[DEPRECATED] ${msg}`);
    next();
  };

  // --- JUGADOR / CARACTERIZACION (legacy) ---
  const playerController = require('./controllers/playerController');
  app.post('/api/choose-race', deprecate('POST /api/choose-race — usar POST /api/v1/hero'), playerController.chooseRace);
  app.post('/api/train-stats', deprecate('POST /api/train-stats — usar POST /api/v1/hero/stats'), playerController.trainStats);
  app.post('/api/rent-bag', deprecate('POST /api/rent-bag — usar POST /api/v1/inventory'), playerController.rentBag);

  // --- HABILIDADES (legacy, requiere auth) ---
  const authMiddleware = require('./middleware/authMiddleware');
  const skillController = require('./controllers/skillController');
  app.get('/api/my-skills', deprecate('GET /api/my-skills — usar GET /api/v1/hero/skills'), authMiddleware, playerController.getMySkills);
  app.post('/api/equip-skill', deprecate('POST /api/equip-skill — usar POST /api/v1/hero/skills/equip'), authMiddleware, playerController.equipSkill);
  app.post('/api/skills/upgrade', deprecate('POST /api/skills/upgrade — usar POST /api/v1/hero/skills/upgrade'), authMiddleware, skillController.upgradeSkill);

  // --- MASCOTAS (legacy) ---
  const petController = require('./controllers/petController');
  app.get('/api/my-pets', deprecate('GET /api/my-pets — usar GET /api/v1/pets'), authMiddleware, petController.getMyPets);
  app.post('/api/equip-pet', deprecate('POST /api/equip-pet — usar POST /api/v1/pets/equip'), authMiddleware, petController.equipPet);
  app.post('/api/feed-pet', deprecate('POST /api/feed-pet — usar POST /api/v1/pets/feed'), authMiddleware, petController.feedPet);

  // --- FONDOS / BACKGROUNDS (legacy) ---
  const bgController = require('./controllers/backgroundController');
  app.get('/api/backgrounds', deprecate('GET /api/backgrounds — usar GET /api/v1/backgrounds'), bgController.getBackgrounds);
  app.post('/api/equip-background', deprecate('POST /api/equip-background — usar POST /api/v1/backgrounds/equip'), bgController.equipBackground);
  app.post('/api/buy-background', deprecate('POST /api/buy-background — usar POST /api/v1/backgrounds/buy'), bgController.buyBackground);

  // --- INVENTARIO (legacy) ---
  const inventoryController = require('./controllers/inventoryController');
  app.post('/api/inventory/move', deprecate('POST /api/inventory/move — usar POST /api/v1/inventory/move'), inventoryController.moveItem);
  app.post('/api/inventory/organize', deprecate('POST /api/inventory/organize — usar POST /api/v1/inventory/organize'), inventoryController.organizeInventory);

  // --- ADMIN / DEBUG (legacy) ---
  app.post('/api/admin/give-item', deprecate('POST /api/admin/give-item — usar endpoint admin en /api/v1'), inventoryController.adminGiveItem);
  app.get('/api/search-users', deprecate('GET /api/search-users — buscar usuarios via panel admin v1'), playerController.searchUsers);

  // 404 y error handlers (deben ir al final)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
