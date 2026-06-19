const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('./config/env');

let io;

exports.init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*", // En producción, especificar el dominio del frontend
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication error"));

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error("Authentication error"));
        }
    });

    io.on('connection', (socket) => {
        // console.log(`User connected: ${socket.user.id}`);
        // Unirse a una sala específica del usuario para recibir notificaciones privadas
        socket.join(socket.user.id);

        socket.on('disconnect', () => {
            // console.log('User disconnected');
        });
    });

    return io;
};

exports.getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
