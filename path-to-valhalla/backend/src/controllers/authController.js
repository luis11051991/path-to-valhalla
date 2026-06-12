const { db, decodeDoc } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { hydratePlayer } = require('../shared/player_stats');

const SECRET_KEY = 'valhalla_secret_key_odin';

// --- REGISTRO (PASO 1: CREAR CUENTA VACIA) ---
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    const safeEmail = email.toLowerCase();

    // 1. Validar duplicados en Firestore
    const usersSnap = await db.collection('players')
      .where('email', '==', safeEmail)
      .where('username', '==', username)
      .get();
    
    if (!usersSnap.empty) {
      return res.status(400).json({ message: 'El nombre o correo ya estan en uso.' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. DATOS POR DEFECTO
    const defaultRace = 'human';
    const defaultGender = 'male';
    const defaultClassId = 1;
    const defaultBgId = 1;
    const defaultStats = JSON.stringify({ strength: 5, dexterity: 5, constitution: 5, intelligence: 5, luck: 5, charisma: 5 });

    // 4. Crear jugador en Firestore
    const newPlayerRef = db.collection('players').doc();
    await newPlayerRef.set({
      username,
      email: safeEmail,
      password_hash: hash,
      race: defaultRace,
      gender: defaultGender,
      class_id: defaultClassId,
      level: 1,
      experience: 0,
      stat_points: 0,
      stats: JSON.parse(defaultStats),
      gold: 10,
      silver: 50,
      copper: 100,
      current_hp: 100,
      energy: 100,
      valor: 5,
      last_regen_at: new Date(),
      active_background_id: defaultBgId,
      last_hall_action_at: new Date(),
      evolution_quest_status: 'locked',
      shop_refreshes_used: 0,
      current_shop_stock: [],
      created_at: new Date(),
    });

    const userId = newPlayerRef.id;

    // 5. Registrar fondo inicial
    await db.collection('player_backgrounds').doc().set({
      player_id: userId,
      background_id: defaultBgId,
    });

    // 6. Obtener URL del fondo y hidratar
    const bgDoc = await db.collection('backgrounds').doc(String(defaultBgId)).get();
    const bgUrl = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

    const playerDoc = await newPlayerRef.get();
    let user = hydratePlayer(await playerDoc.data(), userId);

    // 7. Responder
    const token = jwt.sign({ id: userId }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: 'Cuenta creada! Elige tu destino.', 
      token,
      user: { ...user, active_background_url: bgUrl, real_inventory: [], rented_bags: [] } 
    });
  } catch (err) { 
    console.error('CRITICAL ERROR IN REGISTER:', err); 
    res.status(500).json({ message: 'Error interno del servidor.' }); 
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Faltan credenciales' });

    const safeEmail = email.toLowerCase(); 

    const userSnap = await db.collection('players')
      .where('email', '==', safeEmail)
      .limit(1)
      .get();
    
    if (userSnap.empty) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    const playerDoc = userSnap.docs[0];
    let user = { ...playerDoc.data(), id: playerDoc.id };
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    // Hidratacion y Regeneracion
    user = hydratePlayer(user, user.id);

    // Cargar inventario (subcoleccion items del jugador)
    const itemsSnap = await db.collection('players').doc(user.id).collection('items').orderBy('bag_slot', 'asc').get();
    const inventoryItems = [];
    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      // Obtener template para nombre, icono, etc.
      const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
      if (tplDoc.exists) {
        inventoryItems.push({ ...data, id: itemDoc.id, name: tplDoc.data().name, type: tplDoc.data().type, slot: tplDoc.data().slot, rarity: tplDoc.data().rarity, icon: tplDoc.data().icon, image_url: tplDoc.data().image_url, price_copper: tplDoc.data().price_copper, description: tplDoc.data().description });
      }
    }

    // Background URL
    const bgId = user.active_background_id || 1;
    const bgDoc = await db.collection('backgrounds').doc(String(bgId)).get();
    const bgUrl = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

    // Bag rentals - no needed anymore with Firestore subcollection approach

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        ...user,
        real_inventory: inventoryItems,
        active_background_url: bgUrl,
        rented_bags: []
      } 
    });
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ message: 'Error Server en Login' }); 
  }
};

// --- OBTENER PERFIL (F5) ---
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; 

    const playerDoc = await db.collection('players').doc(userId).get();
    if (!playerDoc.exists) return res.status(404).json({ message: 'Usuario no encontrado.' });

    let user = { ...playerDoc.data(), id: playerDoc.id };

    // Hidratacion y Regeneracion
    user = hydratePlayer(user, userId);

    // Inventario
    const itemsSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
    const inventoryItems = [];
    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
      if (tplDoc.exists) {
        inventoryItems.push({ ...data, id: itemDoc.id, name: tplDoc.data().name, type: tplDoc.data().type, slot: tplDoc.data().slot, rarity: tplDoc.data().rarity, icon: tplDoc.data().icon, image_url: tplDoc.data().image_url, price_copper: tplDoc.data().price_copper, description: tplDoc.data().description });
      }
    }

    const bgId = user.active_background_id || 1;
    const bgDoc = await db.collection('backgrounds').doc(String(bgId)).get();
    const bgUrl = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

    res.json({ 
      user: { 
        ...user,
        real_inventory: inventoryItems,
        active_background_url: bgUrl,
        rented_bags: []
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};
