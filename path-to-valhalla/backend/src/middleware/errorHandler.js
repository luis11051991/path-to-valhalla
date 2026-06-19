const ApiError = require('../lib/ApiError');

const errorHandler = (err, req, res, next) => {
  // PostgreSQL unique violation
  if (err.code === '23505') {
    const field = err.detail?.match(/key \((.+?)\)/)?.[1] || 'unknown';
    return res.status(409).json({
      ok: false,
      error: { code: 'DUPLICATE_KEY', message: `El valor de ${field} ya existe.`, details: { field } },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'El token proporcionado no es válido.' },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      ok: false,
      error: { code: 'TOKEN_EXPIRED', message: 'El token de autenticación ha expirado.' },
    });
  }

  // Joi / validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: err.message, details: err.details },
    });
  }

  // Default ApiError
  if (err instanceof ApiError) {
    const statusCode = [400, 401, 403, 404, 409, 422].includes(err.code) ? 400 : 500;
    return res.status(statusCode).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Unhandled errors
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor.'
    : err.message;

  console.error('[errorHandler]', err);

  return res.status(statusCode).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
};

module.exports = errorHandler;
