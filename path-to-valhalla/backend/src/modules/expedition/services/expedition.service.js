const Expedition = require('../../../models/Expedition');
const Player = require('../../../models/Player');

class ExpeditionService {
  static async createExpedition(expeditionData) {
    try {
      // Validar datos de entrada
      if (!expeditionData || !expeditionData.name || !expeditionData.description) {
        throw new Error('Name and description are required for expedition creation');
      }

      // Crear nueva expedición
      const newExpedition = new Expedition({
        ...expeditionData,
        creator: expeditionData.creatorId || null,
        participants: [],
        status: 'active'
      });

      // Guardar en la base de datos
      const savedExpedition = await newExpedition.save();
      
      return savedExpedition;
    } catch (error) {
      throw new Error(`Failed to create expedition: ${error.message}`);
    }
  }

  static async getExpedition(expeditionId) {
    try {
      // Buscar expedición por ID
      const expedition = await Expedition.findById(expeditionId);
      
      if (!expedition) {
        throw new Error('Expedition not found');
      }
      
      return expedition;
    } catch (error) {
      throw new Error(`Failed to get expedition: ${error.message}`);
    }
  }

  static async getPlayerExpeditions(playerId) {
    try {
      // Buscar todas las expediciones del jugador
      const expeditions = await Expedition.find({
        $or: [
          { creator: playerId },
          { participants: playerId }
        ]
      });
      
      return expeditions;
    } catch (error) {
      throw new Error(`Failed to get player expeditions: ${error.message}`);
    }
  }

  static async joinExpedition(expeditionId, playerId) {
    try {
      // Verificar que la expedición exista
      const expedition = await Expedition.findById(expeditionId);
      if (!expedition) {
        throw new Error('Expedition not found');
      }

      // Verificar que el jugador no esté ya participando
      if (expedition.participants.includes(playerId)) {
        throw new Error('Player is already participating in this expedition');
      }

      // Agregar al jugador a los participantes
      expedition.participants.push(playerId);
      
      // Guardar cambios
      await expedition.save();
      
      return expedition;
    } catch (error) {
      throw new Error(`Failed to join expedition: ${error.message}`);
    }
  }

  static async leaveExpedition(expeditionId, playerId) {
    try {
      // Verificar que la expedición exista
      const expedition = await Expedition.findById(expeditionId);
      if (!expedition) {
        throw new Error('Expedition not found');
      }

      // Eliminar al jugador de los participantes
      expedition.participants = expedition.participants.filter(id => id.toString() !== playerId.toString());
      
      // Guardar cambios
      await expedition.save();
      
      return expedition;
    } catch (error) {
      throw new Error(`Failed to leave expedition: ${error.message}`);
    }
  }

  static async updateExpeditionStatus(expeditionId, status) {
    try {
      // Verificar que el estado sea válido
      const validStatuses = ['active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid expedition status');
      }

      // Actualizar estado de la expedición
      const updatedExpedition = await Expedition.findByIdAndUpdate(
        expeditionId,
        { status },
        { new: true } // Devolver el documento actualizado
      );
      
      if (!updatedExpedition) {
        throw new Error('Expedition not found');
      }
      
      return updatedExpedition;
    } catch (error) {
      throw new Error(`Failed to update expedition status: ${error.message}`);
    }
  }

  static async getPublicExpeditions() {
    try {
      // Obtener todas las expediciones públicas
      const expeditions = await Expedition.find({ isPublic: true });
      
      return expeditions;
    } catch (error) {
      throw new Error(`Failed to get public expeditions: ${error.message}`);
    }
  }

  static async completeExpedition(expeditionId, playerId) {
    try {
      // Verificar que la expedición exista
      const expedition = await Expedition.findById(expeditionId);
      if (!expedition) {
        throw new Error('Expedition not found');
      }

      // Verificar que el jugador sea el creador o participante
      if (expedition.creator.toString() !== playerId.toString() && !expedition.participants.includes(playerId)) {
        throw new Error('Player is not authorized to complete this expedition');
      }

      // Completar la expedición
      expedition.status = 'completed';
      
      // Guardar cambios
      await expedition.save();
      
      return expedition;
    } catch (error) {
      throw new Error(`Failed to complete expedition: ${error.message}`);
    }
  }

  static async cancelExpedition(expeditionId, playerId) {
    try {
      // Verificar que la expedición exista
      const expedition = await Expedition.findById(expeditionId);
      if (!expedition) {
        throw new Error('Expedition not found');
      }

      // Verificar que el jugador sea el creador
      if (expedition.creator.toString() !== playerId.toString()) {
        throw new Error('Player is not authorized to cancel this expedition');
      }

      // Cancelar la expedición
      expedition.status = 'cancelled';
      
      // Guardar cambios
      await expedition.save();
      
      return expedition;
    } catch (error) {
      throw new Error(`Failed to cancel expedition: ${error.message}`);
    }
  }
}

module.exports = ExpeditionService;