// Controlador de inventario - separa HTTP del dominio de negocio

const InventoryService = require('./services/inventory.service');

class InventoryController {
  static async getInventory(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const inventory = await InventoryService.getInventory(playerId);
      res.json(inventory);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  static async updateInventory(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const inventoryData = req.body;
      const updatedInventory = await InventoryService.updateInventory(playerId, inventoryData);
      res.json(updatedInventory);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async addItems(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const items = req.body.items || [];
      const addedItems = await InventoryService.addItems(playerId, items);
      res.json(addedItems);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async removeItems(req, res) {
    try {
      const playerId = req.user?.id;
      if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const itemId = req.params.itemId;
      if (!itemId) {
        return res.status(400).json({ error: 'Item ID is required' });
      }
      
      const removedItems = await InventoryService.removeItems(playerId, itemId);
      res.json(removedItems);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = InventoryController;