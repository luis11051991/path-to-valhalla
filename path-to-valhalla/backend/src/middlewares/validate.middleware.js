// Middleware para validación de datos usando express-validator
const { validationResult } = require('express-validator');
const { authenticate } = require('./auth.middleware');

// Validación genérica que puede ser usada en cualquier ruta
const validate = (validationRules) => {
  return async (req, res, next) => {
    try {
      // Ejecutar las reglas de validación definidas en los controladores
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array()
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Validation error processing'
        }
      });
    }
  };
};

// Funciones de validación específicas que se pueden reutilizar
const validators = {
  // Validar login
  login: [
    require('express-validator').body('email', 'Email is required')
      .isEmail().normalizeEmail(),
    require('express-validator').body('password', 'Password is required')
      .notEmpty()
  ],
  
  // Validar registro
  register: [
    require('express-validator').body('email', 'Email is required')
      .isEmail().normalizeEmail(),
    require('express-validator').body('password', 'Password must be at least 6 characters')
      .isLength({ min: 6 }),
    require('express-validator').body('username', 'Username is required')
      .notEmpty()
  ]
};

module.exports = { validate, validators };