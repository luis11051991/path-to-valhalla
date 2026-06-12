const { db } = require('../config/db');

// 1. OBTENER LISTA (Catalogo + Propiedad)
exports.getBackgrounds = async (req, res) => {
  const { userId } = req.query;

  try {
    const allBgSnap = await db.collection('backgrounds').orderBy('id', 'asc').get();
    
    let ownedIds = new Set();
    if (userId) {
      const ownedSnap = await db.collection('player_backgrounds')
        .where('player_id', '==', userId)
        .get();
      ownedIds = new Set(ownedSnap.docs.map(d => d.data().background_id));
    }

    const result = allBgSnap.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      owned: ownedIds.has(Number(doc.id)),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al cargar fondos' });
  }
};

// 2. EQUIPAR FONDO
exports.equipBackground = async (req, res) => {
  const { userId, backgroundId } = req.body;

  try {
    // Verificar que realmente lo tenga comprado
    const checkSnap = await db.collection('player_backgrounds')
      .where('player_id', '==', userId)
      .where('background_id', '==', Number(backgroundId))
      .limit(1)
      .get();

    if (checkSnap.empty) {
      return res.status(403).json({ message: 'No posees este fondo.' });
    }

    // Actualizar el perfil del jugador
    await db.collection('players').doc(userId).update({ active_background_id: Number(backgroundId) });

    // Devolver la nueva URL
    const bgDoc = await db.collection('backgrounds').doc(String(backgroundId)).get();

    res.json({ success: true, newUrl: bgDoc.exists ? (bgDoc.data().image_url || '') : '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al equipar' });
  }
};

// 3. COMPRAR FONDO
exports.buyBackground = async (req, res) => {
  const { userId, backgroundId } = req.body;

  try {
    // Obtener precio del fondo
    const bgDoc = await db.collection('backgrounds').doc(String(backgroundId)).get();
    if (!bgDoc.exists) return res.status(404).json({ message: 'Fondo no encontrado.' });
    const price = bgDoc.data().price_onyx;

    // Obtener onix del usuario
    const playerDoc = await db.collection('players').doc(userId).get();
    if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado.' });
    const userOnix = playerDoc.data().onix;

    if (userOnix < price) {
      return res.status(400).json({ message: 'No tienes suficiente Onix.' });
    }

    // Verificar si ya lo tiene
    const ownedSnap = await db.collection('player_backgrounds')
      .where('player_id', '==', userId)
      .where('background_id', '==', Number(backgroundId))
      .limit(1)
      .get();

    if (!ownedSnap.empty) return res.status(400).json({ message: 'Ya posees este fondo.' });

    // Transaccion: Restar dinero y Dar producto
    await db.runTransaction(async (t) => {
      t.update(db.collection('players').doc(userId), { onix: userOnix - price });
      t.create(db.collection('player_backgrounds'), { player_id: userId, background_id: Number(backgroundId) });
    });

    res.json({ success: true, message: 'Compra exitosa!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en la compra' });
  }
};
