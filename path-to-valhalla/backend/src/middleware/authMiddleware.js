const { resolveAuthenticatedPlayer } = require('../utils/sessionAuth');

module.exports = async function (req, res, next) {
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No hay token, permiso denegado.' });
  }

  try {
    req.user = await resolveAuthenticatedPlayer(token);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token no valido.' });
  }
};
