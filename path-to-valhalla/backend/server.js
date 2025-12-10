const express = require('express');
const cors = require('cors');

// --- IMPORTACIONES ---
const authController = require('./src/controllers/authController');
const playerController = require('./src/controllers/playerController'); 
const bgController = require('./src/controllers/backgroundController'); 
const inventoryController = require('./src/controllers/inventoryController');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// --- RUTAS (Endpoints) ---
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);
app.post('/api/choose-race', playerController.chooseRace);
app.post('/api/train-stats', playerController.trainStats);
app.post('/api/rent-bag', playerController.rentBag);

// RUTAS DE FONDOS
app.get('/api/backgrounds', bgController.getBackgrounds);
app.post('/api/equip-background', bgController.equipBackground);
app.post('/api/buy-background', bgController.buyBackground);

// RUTAS DE INVENTARIO
app.post('/api/inventory/move', inventoryController.moveItem);

// RUTAS DE ADMIN / DEBUG (Para generar items)
// CORRECCIÓN AQUÍ: Usamos 'adminGiveItem' que es el nombre real en tu controlador
app.post('/api/admin/give-item', inventoryController.adminGiveItem);

// --- ARRANQUE ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`⚡ Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
});