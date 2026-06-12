const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('./config/firebaseAdmin');

let io;

exports.init = (server) => {
    io = socketIo(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) return next(new Error('Authentication error'));

        try {
            // Primero intentar con Firebase token verification
            const decoded = await verifyFirebaseToken(token);
            socket.user = { id: decoded.uid };
            next();
        } catch (err) {
            // Fallback a JWT secret para tokens legacy del backend
            try {
                const LEGACY_SECRET = 'valhalla_secret_key_odin';
                const legacyDecoded = jwt.verify(token, LEGACY_SECRET);
                socket.user = { id: legacyDecoded.id };
                next();
            } catch (err2) {
                next(new Error('Authentication error'));
            }
        }
    });

    io.on('connection', (socket) => {
        if (socket.user && socket.user.id) {
            socket.join(socket.user.id);
        }

        socket.on('disconnect', () => {});
    });

    return io;
};

exports.getIO = () => {
    if (!io) throw new Error('Socket.io not initialized!');
    return io;
};
