// Servidor principal - solo se encarga del arranque y escucha
require('dotenv').config();

const http = require('http');
const socket = require('./src/socket');
const { ensureInitialGameData } = require('./src/seeds/bootstrap');
const app = require('./src/app');
const { validateEnv } = require('./src/config/env');

// Validar variables de entorno antes de arrancar
if (!validateEnv()) {
  console.error('Environment validation failed. Exiting.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Inicializar Socket.IO
socket.init(server);

async function startServer() {
  try {
    await ensureInitialGameData();
    console.log('Initial game data loaded successfully');
  } catch (error) {
    console.error('[seed] Error cargando datos iniciales:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
  });
}

startServer();

module.exports = { server, app };
