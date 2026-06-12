const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../config/firebaseAdmin');

// Legacy secret para compatibilidad con tokens antiguos
const SECRET_KEY = 'valhalla_secret_key_odin';

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No hay token, permiso denegado.' });
  }

  // Primero intentar Firebase ID token verification
  verifyFirebaseToken(token).then((decoded) => {
    req.user = { id: decoded.uid };
    next();
  }).catch(() => {
    // Fallback: intentar con JWT secret legacy
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: 'Token no valido.' });
    }
  });
};
