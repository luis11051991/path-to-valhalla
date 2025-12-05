const express = require('express');
const cors = require('cors');
const authController = require('./src/controllers/authController');
const playerController = require('./src/controllers/playerController'); // <--- Importar arriba

const app = express();

// Middlewares (Configuraciones de seguridad y comunicación)
app.use(cors());
app.use(express.json());

// --- RUTAS (Endpoints) ---
// Aquí definimos a dónde tiene que llamar el Frontend
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);
app.post('/api/choose-race', playerController.chooseRace); // <--- Nueva ruta

// --- ARRANQUE ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`⚡ Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
});
