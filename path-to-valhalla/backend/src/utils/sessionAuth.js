const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const { db } = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'valhalla_secret_key_odin';

async function findPlayerByFirebaseIdentity(firebaseUser) {
  const email = firebaseUser.email?.toLowerCase();

  if (!email) {
    throw new Error('Firebase token missing email');
  }

  let playerSnap = await db.collection('players')
    .where('firebase_uid', '==', firebaseUser.uid)
    .limit(1)
    .get();

  if (playerSnap.empty) {
    playerSnap = await db.collection('players')
      .where('email', '==', email)
      .limit(1)
      .get();
  }

  if (playerSnap.empty) {
    throw new Error('Player not found for Firebase identity');
  }

  const playerDoc = playerSnap.docs[0];

  return {
    id: playerDoc.id,
    email,
    firebaseUid: firebaseUser.uid,
    authSource: 'firebase',
  };
}

async function resolveAuthenticatedPlayer(token) {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    return {
      id: decoded.id,
      authSource: 'jwt',
    };
  } catch (jwtError) {
    const firebaseUser = await verifyFirebaseToken(token);
    return findPlayerByFirebaseIdentity(firebaseUser);
  }
}

module.exports = {
  SECRET_KEY,
  resolveAuthenticatedPlayer,
};
