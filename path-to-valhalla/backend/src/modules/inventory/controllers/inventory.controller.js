// Controlador de inventario - maneja solicitudes HTTP
const InventoryService = require('../services/inventory.service');
const { authenticate } = require('../../../middleware/auth.middleware');

class InventoryController {
  // Obtener inventario completo del jugador
  static async getFullInventory(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const inventory = await InventoryService.getFullInventory(playerId);
      
      res.status(200).json({
        success: true,
        message: 'Inventory retrieved successfully',
        data: {
          items: inventory
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener inventario con paginación
  static async getInventory(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      
      const inventory = await InventoryService.getInventory(playerId, page, limit);
      
      res.status(200).json({
        success: true,
        message: 'Inventory retrieved successfully',
        data: {
          items: inventory.items,
          pagination: {
            page: inventory.page,
            limit: inventory.limit,
            total: inventory.total
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener ítem específico
  static async getItem(req, res, next) {
    try {
      const playerId = req.user?.id;
      const { itemId } = req.params;
      
      if (!playerId || !itemId) {
        return res.status(400).json({
          success: false,
          message: 'Player ID and Item ID are required'
        });
      }

      const item = await InventoryService.getItem(playerId, itemId);
      
      res.status(200).json({
        success: true,
        message: 'Item retrieved successfully',
        data: {
          item
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Añadir ítem al inventario
  static async addItem(req, res, next) {
    try {
      const playerId = req.user?.id;
      
      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const itemData = req.body;
      
      // Validar que el ítem tenga data
      if (!itemData) {
        return res.status(400).json({
          success: false,
          message: 'Item data is required'
        });
      }

      const newItem = await InventoryService.addItem(playerId, itemData);
      
      res.status(201).json({
        success: true,
        message: 'Item added to inventory successfully',
        data: {
          item: newItem
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar cantidad de ítem
  static async updateItemQuantity(req, res, next) {
    try {
      const playerId = req.user?.id;
      const { itemId } = req.params;
      const { quantity } = req.body;
      
      if (!playerId || !itemId || quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Player ID, Item ID and quantity are required'
        });
      }

      const updatedItem = await InventoryService.updateItemQuantity(playerId, itemId, quantity);
      
      res.status(200).json({
        success: true,
        message: 'Item quantity updated successfully',
        data: {
          item: updatedItem
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar ítem del inventario
  static async removeItem(req, res, next) {
    try {
      const playerId = req.user?.id;
      const { itemId } = req.params;
      
      if (!playerId || !itemId) {
        return res.status(400).json({
          success: false,
          message: 'Player ID and Item ID are required'
        });
      }

      const removedItem = await InventoryService.removeItem(playerId, itemId);
      
      res.status(200).json({
        success: true,
        message: 'Item removed from inventory successfully',
        data: {
          item: removedItem
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Usar ítem del inventario
  static async useItem(req, res, next) {
    try {
      const playerId = req.user?.id;
      const { itemId } = req.params;
      
      if (!playerId || !itemId) {
        return res.status(400).json({
          success: false,
          message: 'Player ID and Item ID are required'
        });
      }

      const usedItem = await InventoryService.useItem(playerId, itemId);
      
      res.status(200).json({
        success: true,
        message: 'Item used successfully',
        data: {
          item: usedItem
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener ítems por tipo
  static async getItemsByType(req, res, next) {
    try {
      const playerId = req.user?.id;
      const { type } = req.params;
      
      if (!playerId || !type) {
        return res.status(400).json({
          success: false,
          message: 'Player ID and item type are required'
        });
      }

      const items = await InventoryService.getItemsByType(playerId, type);
      
      res.status(200).json({
        success: true,
        message: 'Items retrieved successfully',
        data: {
          items
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InventoryController;