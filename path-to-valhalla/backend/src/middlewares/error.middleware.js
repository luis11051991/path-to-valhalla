// Middleware para manejo global de errores
const errorMiddleware = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Errores de validación de express-validator
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors || []
      }
    });
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: err.message
      }
    });
  }

  // Errores HTTP personalizados
  if (err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code || 'ERROR',
        message: err.message
      }
    });
  }

  // Errores internos del servidor
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? 
        err.message : 
        'Internal server error'
    }
  });
};

module.exports = { errorMiddleware };