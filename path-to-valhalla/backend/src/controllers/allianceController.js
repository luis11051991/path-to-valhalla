const allianceService = require('../services/allianceService');

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

const requirePlayer = (req, res) => {
    const playerId = getAuthenticatedPlayerId(req);
    if (!playerId) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
        return null;
    }
    return playerId;
};

exports.listAlliances = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.listAlliances(playerId, req.query || {}));
    } catch (error) {
        return sendError(res, error, 'Error al listar alianzas.');
    }
};

exports.getMyAlliance = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getMyAlliance(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener tu alianza.');
    }
};

exports.getPublicProfile = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getPublicProfile(playerId, req.params.allianceId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener alianza.');
    }
};

exports.createAlliance = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.status(201).json(await allianceService.createAlliance(playerId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al crear alianza.');
    }
};

exports.applyToAlliance = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.applyToAlliance(playerId, req.params.allianceId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al enviar solicitud.');
    }
};

exports.getApplications = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getApplications(playerId, req.params.allianceId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener solicitudes.');
    }
};

exports.acceptApplication = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.acceptApplication(playerId, req.params.applicationId));
    } catch (error) {
        return sendError(res, error, 'Error al aceptar solicitud.');
    }
};

exports.rejectApplication = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.rejectApplication(playerId, req.params.applicationId));
    } catch (error) {
        return sendError(res, error, 'Error al rechazar solicitud.');
    }
};

exports.donate = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.donate(playerId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al donar.');
    }
};

exports.getDonationInfo = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getDonationInfo(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener donaciones.');
    }
};

exports.upgradeBuilding = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.upgradeBuilding(playerId, req.params.buildingId));
    } catch (error) {
        return sendError(res, error, 'Error al mejorar edificio.');
    }
};

exports.getMembers = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getMyMembers(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener miembros.');
    }
};

exports.promoteMember = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.promoteMember(playerId, req.params.memberId));
    } catch (error) {
        return sendError(res, error, 'Error al promover miembro.');
    }
};

exports.demoteMember = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.demoteMember(playerId, req.params.memberId));
    } catch (error) {
        return sendError(res, error, 'Error al degradar miembro.');
    }
};

exports.kickMember = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.kickMember(playerId, req.params.memberId));
    } catch (error) {
        return sendError(res, error, 'Error al expulsar miembro.');
    }
};

exports.leaveAlliance = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.leaveAlliance(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al salir de la alianza.');
    }
};

exports.updateSettings = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.updateSettings(playerId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al actualizar alianza.');
    }
};

exports.transferLeadership = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.transferLeadership(playerId, req.body?.newLeaderPlayerId));
    } catch (error) {
        return sendError(res, error, 'Error al transferir liderazgo.');
    }
};

exports.disbandAlliance = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.disbandAlliance(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al disolver alianza.');
    }
};

exports.getJudgements = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getJudgements(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener juicios.');
    }
};

exports.getEligibleJudgementMembers = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.getEligibleJudgementMembers(playerId));
    } catch (error) {
        return sendError(res, error, 'Error al obtener miembros elegibles.');
    }
};

exports.startJudgement = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.status(201).json(await allianceService.startJudgement(playerId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al iniciar juicio.');
    }
};

exports.voteJudgement = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.voteJudgement(playerId, req.params.judgementId, req.body || {}));
    } catch (error) {
        return sendError(res, error, 'Error al votar juicio.');
    }
};

exports.resolveJudgement = async (req, res) => {
    const playerId = requirePlayer(req, res);
    if (!playerId) return;

    try {
        return res.json(await allianceService.resolveJudgement(playerId, req.params.judgementId));
    } catch (error) {
        return sendError(res, error, 'Error al resolver juicio.');
    }
};
