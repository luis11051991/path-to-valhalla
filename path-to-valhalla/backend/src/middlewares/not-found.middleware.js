// Middleware para manejar rutas no encontradas
const notFoundMiddleware = (req, res, next) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`
    }
  });
};

module.exports = { notFoundMiddleware };