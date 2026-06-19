const jwt = require('jsonwebtoken');
const env = require('../config/env');

// JWT_SECRET centralizado desde config/env — misma fuente que authController y socket.js
const SECRET_KEY = env.JWT_SECRET;

module.exports = function (req, res, next) {
  // 1. Leer el token del header (x-auth-token o Authorization)
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

  // 2. Si no hay token, denegar
  if (!token) {
    return res.status(401).json({ message: 'No hay token, permiso denegado.' });
  }

  // 3. Verificar token
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token no válido.' });
  }
};