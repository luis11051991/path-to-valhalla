// Exportar funciones utilitarias
const { isInitialized, db, auth, Timestamp } = require('./firebase');

// Reexportar las funciones que no están en el nuevo archivo firebase.js
// Convert plain JS objects to Firestore-compatible timestamps
function withTimestampsUtil(obj, dateFields) {
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
function decodeDocUtil(doc, timestampFields) {
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

function decodeDocsUtil(querySnap, timestampFields) {
  return querySnap.docs.map(doc => decodeDocUtil(doc, timestampFields));
}

module.exports = {
  db,
  auth,
  withTimestamps: withTimestampsUtil,
  decodeDoc: decodeDocUtil,
  decodeDocs: decodeDocsUtil,
  Timestamp,
  isInitialized
};
