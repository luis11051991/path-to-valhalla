const ExpeditionService = require('../services/expedition.service');

class ExpeditionController {
  static async createExpedition(req, res) {
    try {
      const expeditionData = req.body;
      const expedition = await ExpeditionService.createExpedition(expeditionData);
      res.status(201).json(expedition);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async getExpedition(req, res) {
    try {
      const { expeditionId } = req.params;
      const expedition = await ExpeditionService.getExpedition(expeditionId);
      res.status(200).json(expedition);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async getPlayerExpeditions(req, res) {
    try {
      const playerId = req.user.id;
      const expeditions = await ExpeditionService.getPlayerExpeditions(playerId);
      res.status(200).json(expeditions);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async joinExpedition(req, res) {
    try {
      const { expeditionId } = req.params;
      const playerId = req.user.id;
      await ExpeditionService.joinExpedition(expeditionId, playerId);
      res.status(200).json({ message: 'Joined expedition successfully' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async leaveExpedition(req, res) {
    try {
      const { expeditionId } = req.params;
      const playerId = req.user.id;
      await ExpeditionService.leaveExpedition(expeditionId, playerId);
      res.status(200).json({ message: 'Left expedition successfully' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async updateExpeditionStatus(req, res) {
    try {
      const { expeditionId } = req.params;
      const { status } = req.body;
      await ExpeditionService.updateExpeditionStatus(expeditionId, status);
      res.status(200).json({ message: 'Expedition status updated successfully' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async getPublicExpeditions(req, res) {
    try {
      const expeditions = await ExpeditionService.getPublicExpeditions();
      res.status(200).json(expeditions);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async completeExpedition(req, res) {
    try {
      const { expeditionId } = req.params;
      const playerId = req.user.id;
      await ExpeditionService.completeExpedition(expeditionId, playerId);
      res.status(200).json({ message: 'Expedition completed successfully' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async cancelExpedition(req, res) {
    try {
      const { expeditionId } = req.params;
      const playerId = req.user.id;
      await ExpeditionService.cancelExpedition(expeditionId, playerId);
      res.status(200).json({ message: 'Expedition cancelled successfully' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

module.exports = ExpeditionController;