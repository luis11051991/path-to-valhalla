// Controlador de jugador - maneja solicitudes HTTP
const PlayerService = require('../services/player.service');
const { authenticate } = require('../../../middleware/auth.middleware');

class PlayerController {
  // Obtener perfil del jugador
  static async getProfile(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profile = await PlayerService.getProfile(playerId);
      
      res.status(200).json({
        success: true,
        message: 'Player profile retrieved successfully',
        data: {
          user: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            created_at: profile.created_at,
            race: profile.race,
            gender: profile.gender,
            class_id: profile.class_id,
            tier: profile.tier,
            level: profile.level,
            gold: profile.gold,
            silver: profile.silver,
            copper: profile.copper,
            onix: profile.onix,
            current_hp: profile.current_hp,
            energy: profile.energy,
            valor: profile.valor,
            stats: profile.stats
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar perfil del jugador
  static async updateProfile(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profileData = req.body;
      
      // Validar campos permitidos
      const allowedFields = [
        'username', 'email', 'race', 'gender', 'class_id',
        'tier', 'level', 'gold', 'silver', 'copper', 
        'onix', 'current_hp', 'energy', 'valor', 'stats'
      ];
      
      const filteredData = {};
      Object.keys(profileData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = profileData[key];
        }
      });

      const updatedProfile = await PlayerService.updateProfile(playerId, filteredData);
      
      res.status(200).json({
        success: true,
        message: 'Player profile updated successfully',
        data: {
          user: {
            id: updatedProfile.id,
            username: updatedProfile.username,
            email: updatedProfile.email,
            created_at: updatedProfile.created_at,
            race: updatedProfile.race,
            gender: updatedProfile.gender,
            class_id: updatedProfile.class_id,
            tier: updatedProfile.tier,
            level: updatedProfile.level,
            gold: updatedProfile.gold,
            silver: updatedProfile.silver,
            copper: updatedProfile.copper,
            onix: updatedProfile.onix,
            current_hp: updatedProfile.current_hp,
            energy: updatedProfile.energy,
            valor: updatedProfile.valor,
            stats: updatedProfile.stats
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas del jugador
  static async getStats(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const stats = await PlayerService.getStats(playerId);
      
      res.status(200).json({
        success: true,
        message: 'Player stats retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar estadísticas del jugador
  static async updateStats(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const statsData = req.body;
      
      const updatedStats = await PlayerService.updateStats(playerId, statsData);
      
      res.status(200).json({
        success: true,
        message: 'Player stats updated successfully',
        data: updatedStats
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener listado de jugadores
  static async getList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      
      const players = await PlayerService.getList(page, limit);
      
      res.status(200).json({
        success: true,
        message: 'Players list retrieved successfully',
        data: {
          players,
          page,
          limit,
          total: players.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar jugador por nombre
  static async searchByName(req, res, next) {
    try {
      const { name } = req.query;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Player name is required'
        });
      }

      const players = await PlayerService.searchByName(name);
      
      res.status(200).json({
        success: true,
        message: 'Players search completed successfully',
        data: {
          players,
          total: players.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PlayerController;