// Controlador de jugador - separa HTTP del dominio de negocio

const PlayerService = require('./services/player.service');

class PlayerController {
  static async getProfile(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const profile = await PlayerService.getProfile(playerId);
      res.json(profile);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  static async updateProfile(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const profileData = req.body;
      const updatedProfile = await PlayerService.updateProfile(playerId, profileData);
      res.json(updatedProfile);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getStats(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const stats = await PlayerService.getStats(playerId);
      res.json(stats);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  static async updateStats(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const statsData = req.body;
      const updatedStats = await PlayerService.updateStats(playerId, statsData);
      res.json(updatedStats);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getList(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const players = await PlayerService.getList(page, limit);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async searchByName(req, res) {
    try {
      const name = req.query.name;
      if (!name) {
        return res.status(400).json({ error: 'Name query parameter is required' });
      }
      
      const players = await PlayerService.searchByName(name);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = PlayerController;