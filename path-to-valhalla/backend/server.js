const express = require('express');
const cors = require('cors');

// --- IMPORTACIONES DE CONTROLADORES ---
const authController = require('./src/controllers/authController');
const playerController = require('./src/controllers/playerController'); 
const bgController = require('./src/controllers/backgroundController'); 
const inventoryController = require('./src/controllers/inventoryController');
const petController = require('./src/controllers/petController');
const skillController = require('./src/controllers/skillController');

// --- IMPORTACIÓN DE MIDDLEWARES ---
const authMiddleware = require('./src/middleware/authMiddleware'); 

// --- IMPORTAR GESTORES DE RUTAS (Routers) ---
const authRoutes = require('./src/routes/authRoutes');
const evolutionRoutes = require('./src/routes/evolutionRoutes');
const expeditionRoutes = require('./src/routes/expeditionRoutes');
const packageRoutes = require('./src/routes/packageRoutes'); 
const shopRoutes = require('./src/routes/shopRoutes'); 
const workshopRoutes = require('./src/routes/workshopRoutes'); 
const questRoutes = require('./src/routes/questRoutes'); // <--- 1. NUEVO IMPORT

const app = express();

// Middlewares Globales
app.use(cors());
app.use(express.json());

// --- 1. RUTAS NUEVAS (Router) ---
app.use('/api/auth', authRoutes); 
app.use('/api/evolution', evolutionRoutes);
app.use('/api/expeditions', expeditionRoutes);
app.use('/api/packages', packageRoutes); 
app.use('/api/shop', shopRoutes); 
app.use('/api/workshop', workshopRoutes); 
app.use('/api/quests', questRoutes); // <--- 2. CONECTADO AQUÍ

// --- 2. RUTAS DE COMPATIBILIDAD (Legacy) ---
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);

// --- 3. RUTAS DE JUGADOR ---
app.post('/api/choose-race', playerController.chooseRace);
app.post('/api/train-stats', playerController.trainStats);
app.post('/api/rent-bag', playerController.rentBag);

// ---> RUTAS DE HABILIDADES <---
app.get('/api/my-skills', authMiddleware, playerController.getMySkills);
app.post('/api/equip-skill', authMiddleware, playerController.equipSkill);
app.post('/api/skills/upgrade', authMiddleware, skillController.upgradeSkill);

// ---> RUTAS DE MASCOTAS <---
app.get('/api/my-pets', authMiddleware, petController.getMyPets);
app.post('/api/equip-pet', authMiddleware, petController.equipPet);
app.post('/api/feed-pet', authMiddleware, petController.feedPet);

// --- 4. RUTAS DE FONDOS ---
app.get('/api/backgrounds', bgController.getBackgrounds);
app.post('/api/equip-background', bgController.equipBackground);
app.post('/api/buy-background', bgController.buyBackground);

// --- 5. RUTAS DE INVENTARIO ---
app.post('/api/inventory/move', inventoryController.moveItem);
app.post('/api/inventory/organize', inventoryController.organizeInventory);

// --- 6. RUTAS DE ADMIN / DEBUG ---
app.post('/api/admin/give-item', inventoryController.adminGiveItem);

// --- ARRANQUE ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`⚡ Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
});
