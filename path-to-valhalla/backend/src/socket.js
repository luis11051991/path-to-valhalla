const socketIo = require('socket.io');
const { resolveAuthenticatedPlayer } = require('./utils/sessionAuth');

let io;

exports.init = (server) => {
    io = socketIo(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

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
