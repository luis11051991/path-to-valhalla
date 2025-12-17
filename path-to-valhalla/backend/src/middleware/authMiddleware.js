const jwt = require('jsonwebtoken');
const SECRET_KEY = 'valhalla_secret_key_odin'; // Misma clave que en authController

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
    req.user = decoded; // Guardamos el ID del usuario en la petición
    next(); // Dejamos pasar al siguiente paso
  } catch (err) {
    res.status(401).json({ message: 'Token no válido.' });
  }
};