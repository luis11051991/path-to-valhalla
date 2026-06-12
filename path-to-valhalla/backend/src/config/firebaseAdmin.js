// Firebase Admin SKD - Server Side
const path = require('path');
const { initializeApp, getApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
let firebaseApp = null;
let auth = null;
let db = null;

try {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);
  
  if (getApps().length === 0) {
    firebaseApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    firebaseApp = getApp();
  }
} catch (error) {
  console.warn('Firebase Admin SDK not configured:', error.message);
}

if (firebaseApp) {
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

async function verifyFirebaseToken(idToken) {
  if (!auth) throw new Error('Firebase Admin SDK not initialized');
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      picture: decodedToken.picture,
    };
  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    throw new Error('Invalid Firebase token');
  }
}

module.exports = { auth, db, verifyFirebaseToken };
