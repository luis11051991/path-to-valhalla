const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

let db, auth;

try {
  const serviceAccount = require('../serviceAccountKey.json');
  const app = initializeApp({
    credential: cert(serviceAccount),
  });
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error('Firestore initialization error:', error.message);
  db = null;
  auth = null;
}

// Convert plain JS objects to Firestore-compatible timestamps
function withTimestamps(obj, dateFields) {
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
}

// Convert Firestore doc to plain object with decoded timestamps
function decodeDoc(doc, timestampFields) {
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
}

function decodeDocs(querySnap, timestampFields) {
  return querySnap.docs.map(doc => decodeDoc(doc, timestampFields));
}

module.exports = {
  db, auth, withTimestamps, decodeDoc, decodeDocs, Timestamp,
};
