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
const { db } = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'valhalla_secret_key_odin';

// --- LOGIN/REGISTER VIA FIREBASE ---
router.post('/firebase-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Token de Firebase requerido.' });

    // Verify the Firebase ID token
    const firebaseUser = await verifyFirebaseToken(idToken);

    // Find player in Firestore
    const userSnap = await db.collection('players')
      .where('email', '==', firebaseUser.email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      // --- NEW PLAYER: Auto-register ---
      const email = firebaseUser.email?.toLowerCase() || '';
      const username = firebaseUser.displayName || email.split('@')[0] || 'warrior';
      const defaultRace = 'human';
      const defaultGender = email.includes('woman') ? 'female' : 'male';

      const hash = await bcrypt.genSalt(10);
      const fakeHash = await bcrypt.hash(idToken, hash);

      const newPlayerRef = db.collection('players').doc();
      await newPlayerRef.set({
        username, email: firebaseUser.email, password_hash: fakeHash,
        race: defaultRace, gender: defaultGender, class_id: 1, level: 1, experience: 0, stat_points: 0,
        stats: JSON.stringify({ strength: 5, dexterity: 5, constitution: 5, intelligence: 5, luck: 5, charisma: 5 }),
        gold: 10, silver: 50, copper: 100, current_hp: 100, energy: 100, valor: 5,
        last_regen_at: new Date(), active_background_id: 1, shop_refreshes_used: 0, current_shop_stock: [],
        evolution_quest_status: 'locked', created_at: new Date(),
      });

      const player = { ...newPlayerRef.data ? await newPlayerRef.get().then(d => d.data()) : {}, id: newPlayerRef.id };
      
      // Register initial background
      await db.collection('player_backgrounds').add({ player_id: newPlayerRef.id, background_id: 1 });

      const bgDoc = await db.collection('backgrounds').doc('1').get();
      const bgUrl = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

      // Hydrate and generate token
      let hydrated = hydratePlayer({ ...player, id: newPlayerRef.id }, newPlayerRef.id);
      const token = jwt.sign({ id: newPlayerRef.id }, SECRET_KEY, { expiresIn: '7d' });

      return res.status(201).json({ message: 'Nuevo guerrero! Elige tu camino.', token, user: { ...hydrated, active_background_url: bgUrl, real_inventory: [], rented_bags: [] }, isNewPlayer: true });
    }

    // --- EXISTING PLAYER: Login ---
    let player = { ...userSnap.docs[0].data(), id: userSnap.docs[0].id };
    const hydrated = hydratePlayer(player, player.id);

    const bgDoc2 = await db.collection('backgrounds').doc(String(player.active_background_id || 1)).get();
    const bgUrl = bgDoc2.exists ? (bgDoc2.data().image_url || '') : '';

    const token = jwt.sign({ id: player.id }, SECRET_KEY, { expiresIn: '7d' });

    return res.json({ message: 'Regreso glorioso.', token, user: { ...hydrated, active_background_url: bgUrl, real_inventory: [], rented_bags: [] }, isNewPlayer: false });

  } catch (err) {
    console.error('Firebase login error:', err);
    res.status(500).json({ message: 'Error del servidor en Firebase login' });
  }
});

module.exports = router;
