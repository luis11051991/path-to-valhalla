// ============================================================
// Firebase Admin SDK - Server Side (Backend)
// Used for: Verifying Firebase Auth tokens, Firestore access
// ============================================================

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let firebaseApp;

try {
  // Check if we have service account credentials (production)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Use application default credentials (Firebase CLI / GCloud SDK)
    firebaseApp = initializeApp(applicationDefault());
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK not configured. Token verification will be disabled.');
  console.warn('   Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or run "firebase login"');
}

const auth = firebaseApp ? getAuth() : null;
const db = firebaseApp ? getFirestore() : null;

// Verify a Firebase ID token and return the decoded claims
async function verifyFirebaseToken(idToken) {
  if (!auth) {
    throw new Error('Firebase Admin SDK not initialized');
  }
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
