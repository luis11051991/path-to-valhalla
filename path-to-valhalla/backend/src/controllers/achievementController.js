const achievementService = require('../services/achievementService');

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

exports.getAchievements = async (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    try {
        const data = await achievementService.getUserAchievements(playerId);
        return res.json(data);
    } catch (error) {
        return sendError(res, error, 'Error al obtener logros.');
    }
};

exports.claimAchievement = async (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    const achievementId = Number.parseInt(req.params.achievementId, 10);
    if (!Number.isInteger(achievementId) || achievementId <= 0) {
        return res.status(400).json({ success: false, message: 'ID de logro inválido.' });
    }

    try {
        const result = await achievementService.claimAchievement(playerId, achievementId);
        return res.json(result);
    } catch (error) {
        return sendError(res, error, 'Error al reclamar logro.');
    }
};

exports.claimAllAchievements = async (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    try {
        const result = await achievementService.claimAllAchievements(playerId);
        return res.json(result);
    } catch (error) {
        return sendError(res, error, 'Error al reclamar logros.');
    }
};

exports.updateProgress = async (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    const { type, amount = 1, metadata = {} } = req.body || {};
    if (!type) {
        return res.status(400).json({ success: false, message: 'Tipo de progreso requerido.' });
    }

    try {
        const result = await achievementService.incrementProgress(playerId, type, amount, metadata);
        return res.json(result);
    } catch (error) {
        return sendError(res, error, 'Error al actualizar progreso de logro.');
    }
};
