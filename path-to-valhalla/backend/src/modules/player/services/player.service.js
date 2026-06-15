// Servicio de jugador - contiene reglas de negocio para el dominio player
const { db } = require('../../../config/db');

class PlayerService {
  // Obtener perfil del jugador
  static async getProfile(playerId) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) {
      throw new Error('Player not found');
    }
    
    const userData = { ...playerDoc.data(), id: playerDoc.id };
    return userData;
  }

  // Obtener estadísticas del jugador
  static async getStats(playerId) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) {
      throw new Error('Player not found');
    }
    
    const playerData = playerDoc.data();
    
    return {
      stats: playerData.stats,
      level: playerData.level,
      experience: playerData.experience,
      gold: playerData.gold,
      silver: playerData.silver,
      copper: playerData.copper,
      onix: playerData.onix,
      current_hp: playerData.current_hp,
      energy: playerData.energy,
      valor: playerData.valor
    };
  }

  // Actualizar perfil del jugador
  static async updateProfile(playerId, profileData) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Validar que no se actualicen campos sensibles
    const disallowedFields = ['password_hash', 'email'];
    for (const field of disallowedFields) {
      if (profileData[field] !== undefined) {
        throw new Error(`Cannot update ${field}`);
      }
    }

    // Actualizar documento
    await db.collection('players').doc(playerId).update(profileData);
    
    // Obtener datos actualizados
    const playerDoc = await db.collection('players').doc(playerId).get();
    const userData = { ...playerDoc.data(), id: playerDoc.id };
    
    return userData;
  }

  // Actualizar estadísticas del jugador
  static async updateStats(playerId, statsData) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Validar campos permitidos para actualización de estadísticas
    const allowedFields = [
      'stats', 'level', 'experience', 'gold', 
      'silver', 'copper', 'onix', 'current_hp', 
      'energy', 'valor', 'stat_points'
    ];

    const filteredData = {};
    Object.keys(statsData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = statsData[key];
      }
    });

    // Actualizar documento
    await db.collection('players').doc(playerId).update(filteredData);
    
    // Obtener datos actualizados
    const playerDoc = await db.collection('players').doc(playerId).get();
    const userData = { ...playerDoc.data(), id: playerDoc.id };
    
    return userData;
  }

  // Obtener listado de jugadores (con paginación)
  static async getList(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const playersSnap = await db.collection('players')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
    
    const players = [];
    playersSnap.forEach(doc => {
      players.push({ ...doc.data(), id: doc.id });
    });

    return players;
  }

  // Buscar jugador por nombre
  static async searchByName(name) {
    if (!name) {
      throw new Error('Player name is required');
    }

    const playersSnap = await db.collection('players')
      .where('username', '>=', name)
      .where('username', '<=', name + '\uf8ff')
      .limit(10)
      .get();
    
    const players = [];
    playersSnap.forEach(doc => {
      players.push({ ...doc.data(), id: doc.id });
    });

    return players;
  }

  // Obtener experiencia requerida para siguiente nivel
  static calculateNextLevelExp(level) {
    if (level < 1) level = 1;
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }
}

module.exports = PlayerService;