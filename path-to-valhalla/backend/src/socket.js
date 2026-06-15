// Socket.IO inicialización y configuración
const socketIo = require('socket.io');
const { resolveAuthenticatedPlayer } = require('./utils/sessionAuth');

let io;

const initSocket = (server) => {
  // Configurar Socket.IO con CORS apropiado
  const corsOptions = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()) : 
    ['*'];

  io = socketIo(server, {
    cors: {
      origin: corsOptions,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware de autenticación para Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      socket.user = await resolveAuthenticatedPlayer(token);
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  // Manejo de conexiones
  io.on('connection', (socket) => {
    if (socket.user && socket.user.id) {
      socket.join(socket.user.id);
    }

    socket.on('disconnect', () => {});
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

module.exports = {
  init: initSocket,
  getIO
};
