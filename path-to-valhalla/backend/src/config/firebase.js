// Configuración inicial de Firebase Admin
const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

let db, auth;

function initializeFirebase() {
  try {
    // Primero intentamos cargar desde variables de entorno
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      if (getApps().length === 0) {
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        getApp();
      }
      db = getFirestore(getApp());
      auth = getAuth(getApp());
    } else {
      throw new Error('FIREBASE_ADMIN_CREDENTIALS environment variable is required');
    }
    
    console.log('Firebase Admin initialized successfully from environment variables');
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    db = null;
    auth = null;
    // No lanzar error aquí para permitir que el servidor arranque y se maneje en otro nivel
  }
}

// Inicializar Firebase inmediatamente
initializeFirebase();

// Exportar funciones y propiedades
function isInitialized() {
  return db !== null && auth !== null;
}

// Use a different approach - directly define the required utility functions here to
// avoid circular dependency between firebase.js and db.js
// Convert plain JS objects to Firestore-compatible timestamps
const withTimestamps = (obj, dateFields) => {
  if (!obj) return obj;
  const result = { ...obj };
  for (const field of (Array.isArray(dateFields) ? dateFields : [dateFields])) {
    if (result[field] instanceof Date || typeof result[field] === 'string') {
      result[field] = Timestamp.fromDate(
        result[field] instanceof Date ? result[field] : new Date(result[field])
      );
    }
  }
  return result;
};

// Convert Firestore doc to plain object with decoded timestamps
const decodeDoc = (doc, timestampFields) => {
  if (!doc || !doc.data) return null;
  const data = doc.data();
  const obj = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp && timestampFields?.includes(key)) {
      obj[key] = value.toDate();
    } else if (value instanceof Timestamp) {
      obj[key] = value.toDate().toISOString();
    } else if (Buffer.isBuffer(value)) {
      obj[key] = value.toString('base64');
    } else {
      obj[key] = value;
    }
  }
  if (doc.id) obj.id = doc.id;
  return obj;
};

const decodeDocs = (querySnap, timestampFields) => {
  return querySnap.docs.map(doc => decodeDoc(doc, timestampFields));
};

module.exports = {
  db,
  auth, 
  withTimestamps,
  decodeDoc,
  decodeDocs,
  Timestamp,
  isInitialized
};