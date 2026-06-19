const http = require('http');
const { createApp } = require('./src/app');
const socket = require('./src/socket');
const env = require('./src/config/env');

// Crear app Express
const app = createApp();

// Arrancar servidor HTTP
const PORT = env.PORT;
const server = http.createServer(app);

// Configurar Socket.IO despues de crear el server
socket.init(server);

server.listen(PORT, () => {
  console.log(`⚡ Servidor de Path to Valhalla corriendo en puerto ${PORT}`);
});
