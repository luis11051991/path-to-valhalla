const statisticsService = require('../services/statisticsService');

const getAuthenticatedPlayerId = (req) => req.user?.id || req.user?.playerId || req.player?.id;

const sendError = (res, error, fallbackMessage) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
        console.error(fallbackMessage, error);
    }
    return res.status(statusCode).json({
        success: false,
        message: error.message || fallbackMessage
    });
};

exports.getStatistics = async (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    try {
        const data = await statisticsService.getPlayerStatistics(playerId);
        return res.json(data);
    } catch (error) {
        return sendError(res, error, 'Error al obtener estadisticas.');
    }
};
