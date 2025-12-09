const express = require('express');
const cors = require('cors');

// --- IMPORTACIONES ---
// Fíjate que todas deben llevar "./src/" al principio
const authController = require('./src/controllers/authController');
const playerController = require('./src/controllers/playerController'); 
const bgController = require('./src/controllers/backgroundController'); // <--- CORREGIDO AQUÍ (Faltaba /src/)

const app = express();

// Middlewares (Configuraciones de seguridad y comunicación)
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

// --- ARRANQUE ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`⚡ Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
});