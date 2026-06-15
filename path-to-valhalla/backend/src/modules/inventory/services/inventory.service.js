// Servicio de inventario - contiene reglas de negocio para el dominio inventory
const { db } = require('../../../config/db');

class InventoryService {
  // Obtener inventario completo del jugador
  static async getFullInventory(playerId) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Obtener items del inventario del jugador
    const inventorySnap = await db.collection('player_inventory')
      .where('player_id', '==', playerId)
      .orderBy('created_at', 'desc')
      .get();
    
    const inventoryItems = [];
    inventorySnap.forEach(doc => {
      inventoryItems.push({ ...doc.data(), id: doc.id });
    });

    return inventoryItems;
  }

  // Obtener inventario con paginación
  static async getInventory(playerId, page = 1, limit = 20) {
    if (!playerId) {
      throw new Error('Player ID is required');
    }

    const offset = (page - 1) * limit;
    
    const inventorySnap = await db.collection('player_inventory')
      .where('player_id', '==', playerId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
    
    const inventoryItems = [];
    inventorySnap.forEach(doc => {
      inventoryItems.push({ ...doc.data(), id: doc.id });
    });

    return {
      items: inventoryItems,
      page,
      limit,
      total: inventoryItems.length
    };
  }

  // Obtener un item específico del inventario
  static async getItem(playerId, itemId) {
    if (!playerId || !itemId) {
      throw new Error('Player ID and Item ID are required');
    }

    const itemDoc = await db.collection('player_inventory').doc(itemId).get();
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const itemData = itemDoc.data();
    
    // Verificar que el item pertenece al jugador
    if (itemData.player_id !== playerId) {
      throw new Error('Item does not belong to this player');
    }
    
    return { ...itemData, id: itemDoc.id };
  }

  // Añadir ítem al inventario
  static async addItem(playerId, itemData) {
    if (!playerId || !itemData) {
      throw new Error('Player ID and item data are required');
    }

    // Validar campos requeridos
    const requiredFields = ['item_id', 'quantity'];
    for (const field of requiredFields) {
      if (!itemData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    // Añadir ítem al inventario del jugador
    const newItemRef = db.collection('player_inventory').doc();
    const newItem = {
      ...itemData,
      player_id: playerId,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await newItemRef.set(newItem);
    
    return { ...newItem, id: newItemRef.id };
  }

  // Actualizar cantidad de ítem en inventario
  static async updateItemQuantity(playerId, itemId, quantity) {
    if (!playerId || !itemId || quantity === undefined) {
      throw new Error('Player ID, Item ID and quantity are required');
    }

    const itemDoc = await db.collection('player_inventory').doc(itemId).get();
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const itemData = itemDoc.data();
    
    // Verificar que el ítem pertenece al jugador
    if (itemData.player_id !== playerId) {
      throw new Error('Item does not belong to this player');
    }

    // Actualizar cantidad
    await db.collection('player_inventory').doc(itemId).update({
      quantity,
      updated_at: new Date()
    });

    return { ...itemData, id: itemDoc.id, quantity };
  }

  // Eliminar ítem del inventario
  static async removeItem(playerId, itemId) {
    if (!playerId || !itemId) {
      throw new Error('Player ID and Item ID are required');
    }

    const itemDoc = await db.collection('player_inventory').doc(itemId).get();
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const itemData = itemDoc.data();
    
    // Verificar que el ítem pertenece al jugador
    if (itemData.player_id !== playerId) {
      throw new Error('Item does not belong to this player');
    }

    // Eliminar ítem
    await db.collection('player_inventory').doc(itemId).delete();

    return { ...itemData, id: itemDoc.id };
  }

  // Usar un ítem del inventario
  static async useItem(playerId, itemId) {
    if (!playerId || !itemId) {
      throw new Error('Player ID and Item ID are required');
    }

    const itemDoc = await db.collection('player_inventory').doc(itemId).get();
    
    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const itemData = itemDoc.data();
    
    // Verificar que el ítem pertenece al jugador
    if (itemData.player_id !== playerId) {
      throw new Error('Item does not belong to this player');
    }

    // Obtener información del ítem desde la colección de items
    const itemDefinition = await db.collection('items').doc(itemData.item_id).get();
    if (!itemDefinition.exists) {
      throw new Error('Item definition not found');
    }
    
    const itemDef = itemDefinition.data();

    // Aplicar efecto del ítem (simplificado)
    let updatedUserData = {};
    if (itemDef.effect_type === 'health') {
      updatedUserData.current_hp = Math.min(
        itemData.player_info.current_hp + itemDef.effect_value, 
        itemData.player_info.max_hp
      );
    } else if (itemDef.effect_type === 'energy') {
      updatedUserData.energy = Math.min(
        itemData.player_info.energy + itemDef.effect_value, 
        100
      );
    }

    // Actualizar el inventario y datos del jugador
    const transaction = db.runTransaction(async (t) => {
      t.update(db.collection('player_inventory').doc(itemId), { quantity: itemData.quantity - 1 });
      
      // Si la cantidad es 0, eliminar el ítem
      if (itemData.quantity <= 1) {
        t.delete(db.collection('player_inventory').doc(itemId));
      }
      
      return { ...itemData, id: itemDoc.id };
    });

    return await transaction;
  }

  // Obtener ítems por tipo
  static async getItemsByType(playerId, type) {
    if (!playerId || !type) {
      throw new Error('Player ID and item type are required');
    }

    const inventorySnap = await db.collection('player_inventory')
      .where('player_id', '==', playerId)
      .where('item_type', '==', type)
      .get();
    
    const items = [];
    inventorySnap.forEach(doc => {
      items.push({ ...doc.data(), id: doc.id });
    });

    return items;
  }
}

module.exports = InventoryService;