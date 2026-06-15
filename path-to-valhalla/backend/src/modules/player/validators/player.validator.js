// Validadores de jugador - reglas de validación para datos de entrada
const { body, query, validationResult } = require('express-validator');

// Validación para actualización de perfil
const validateProfileUpdate = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female or other'),
  body('race')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Race must be between 3 and 20 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Validación para consulta de jugadores
const validatePlayerListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Validación para búsqueda de jugadores
const validatePlayerSearchQuery = [
  query('name')
    .notEmpty()
    .withMessage('Name parameter is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateProfileUpdate,
  validatePlayerListQuery,
  validatePlayerSearchQuery
};