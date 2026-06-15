// Middleware de autenticación JWT
const jwt = require('jsonwebtoken');
const admin = require('../config/firebaseAdmin');

// Función para verificar token JWT
function verifyToken(token) {
  try {
    // Verificar y decodificar el token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('JWT token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid JWT token');
    }
    throw error;
  }
}

// Middleware de autenticación
const authenticate = async (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header missing or invalid'
        }
      });
    }

    const token = authHeader.substring(7); // Eliminar "Bearer "

    // Verificar el token JWT local
    const jwtVerification = verifyToken(token);
    
    if (!jwtVerification.valid) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authorization token'
        }
      });
    }

    req.user = jwtVerification.decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || 'Authentication failed'
      }
    });
  }
};

module.exports = { authenticate };