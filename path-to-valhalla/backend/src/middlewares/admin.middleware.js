// Middleware para verificar permisos administrativos
const { authenticate } = require('./auth.middleware');

// Verificar si el usuario tiene privilegios de administrador
const isAdmin = async (req, res, next) => {
  try {
    // Primero verificar autenticación básica
    await authenticate(req, res, (err) => {
      if (err) return;
      
      // Verificar rol de administrador
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Administrative privileges required'
          }
        });
      }
      
      next();
    });
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied'
      }
    });
  }
};

module.exports = { isAdmin };