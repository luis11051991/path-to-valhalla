// Firebase Admin SDK - Server Side
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let firebaseApp = null;
let auth = null;
let db = null;

// Cargar credenciales desde variables de entorno
let credentialConfig = null;

if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
  // Configuración de credenciales desde variables de entorno (JSON directo)
  credentialConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
} else if (process.env.FIREBASE_ADMIN_TYPE &&
  process.env.FIREBASE_ADMIN_PROJECT_ID &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  process.env.FIREBASE_ADMIN_CLIENT_ID) {
  // Configuración de credenciales desde variables de entorno
  credentialConfig = {
    type: process.env.FIREBASE_ADMIN_TYPE,
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
    auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL
  };
} else if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
  // Carga directa de credenciales en formato JSON como cadena
  credentialConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
}

if (credentialConfig) {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp({ credential: cert(credentialConfig) });
    } else {
      firebaseApp = getApp();
    }

    if (firebaseApp) {
      auth = getAuth(firebaseApp);
      db = getFirestore(firebaseApp);
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    throw error;
  }
} else {
  // En producción no se puede iniciar sin credenciales
  if (process.env.NODE_ENV === 'production') {
    console.error('Firebase Admin SDK requires credentials in production environment');
    throw new Error('Missing Firebase Admin credentials');
  } else {
    console.warn('Firebase Admin SDK not configured with environment variables');
  }
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
