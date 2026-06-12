// ============================================================
// Firebase Auth Routes - Server Side
// Handles Google sign-in via Firebase ID tokens
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const { hydratePlayer } = require('../shared/player_stats');
const db = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'valhalla_secret_key_odin';

// --- LOGIN/REGISTER VIA FIREBASE ---
router.post('/firebase-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Token de Firebase requerido.' });

    // Verify the Firebase ID token
    const firebaseUser = await verifyFirebaseToken(idToken);

    // Find or create the player in our DB
    let userResult;
    try {
      userResult = await db.query(
        'SELECT * FROM players WHERE email = ',
        [firebaseUser.email]
      );
    } catch (dbErr) {
      console.log('Database not available, returning Firebase user info');
      return res.json({
        message: 'Firebase login exitoso (DB no disponible)',
        token: null,
        user: { ...firebaseUser, username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] },
        isNewPlayer: false,
      });
    }

    if (userResult.rows.length === 0) {
      // --- NEW PLAYER: Auto-register ---
      const email = firebaseUser.email?.toLowerCase() || '';
      const username = firebaseUser.displayName || email.split('@')[0] || 'warrior';
      const defaultRace = 'human';
      const defaultGender = email.includes('woman') ? 'female' : 'male';

      const hash = await bcrypt.genSalt(10);
      const fakeHash = await bcrypt.hash(idToken, hash);

      const insertQuery = 
        INSERT INTO players 
        (username, email, password_hash, race, gender, silver, copper, current_hp, energy, valor, last_regen_at, active_background_id, class_id, stats) 
        VALUES (, , , , , 10, 50, 100, 100, 5, NOW(), 1, 1, '{"strength":5,"dexterity":5,"constitution":5,"intelligence":5,"luck":5,"charisma":5}') 
        RETURNING *
      ;

      const newUser = await db.query(insertQuery, [
        username, email, fakeHash, defaultRace, defaultGender
      ]);

      let player = newUser.rows[0];

      // Register initial background
      await db.query(
        'INSERT INTO player_backgrounds (player_id, background_id) VALUES (, )',
        [player.id, 1]
      );

      const bgResult = await db.query('SELECT image_url FROM backgrounds WHERE id = ', [1]);
      const bgUrl = bgResult.rows[0]?.image_url || '';

      // Hydrate and generate token
      player = await hydratePlayer(player.id);
      const token = jwt.sign({ id: player.id }, SECRET_KEY, { expiresIn: '7d' });

      return res.status(201).json({
        message: '¡Nuevo guerrero! Elige tu camino.',
        token,
        user: { ...player, active_background_url: bgUrl, real_inventory: [], rented_bags: [] },
        isNewPlayer: true,
      });
    }

    // --- EXISTING PLAYER: Login ---
    let player = userResult.rows[0];
    player = await hydratePlayer(player);

    const itemsQuery = 
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
      it.image_url, it.price_copper, it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = 
      ORDER BY pi.bag_slot ASC
    ;
    const itemsResult = await db.query(itemsQuery, [player.id]);

    const bgId = player.active_background_id || 1;
    const bgResult2 = await db.query('SELECT image_url FROM backgrounds WHERE id = ', [bgId]);
    const bgUrl = bgResult2.rows.length > 0 ? bgResult2.rows[0].image_url : '';

    const bagsResult = await db.query(
      'SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id =  AND expires_at > NOW()',
      [player.id]
    );

    const token = jwt.sign({ id: player.id }, SECRET_KEY, { expiresIn: '7d' });

    return res.json({
      message: 'Regreso glorioso.',
      token,
      user: {
        ...player,
        real_inventory: itemsResult.rows,
        active_background_url: bgUrl,
        rented_bags: bagsResult.rows,
      },
      isNewPlayer: false,
    });

  } catch (err) {
    console.error('Firebase login error:', err);
    res.status(500).json({ message: 'Error del servidor en Firebase login' });
  }
});

module.exports = router;
