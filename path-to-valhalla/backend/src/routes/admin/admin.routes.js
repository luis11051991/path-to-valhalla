// Rutas de administración - solo disponibles en entornos no productivos
const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middlewares/admin.middleware');

// Middleware para verificar permisos admin (solo en modo no producción)
const adminMiddleware = process.env.NODE_ENV === 'production' 
  ? [] 
  : [isAdmin];

// Ruta de ejemplo de administración - podría ser para seed, mantenimiento, etc.
router.post('/seed-data', adminMiddleware, async (req, res) => {
  try {
    // En un entorno de producción estas rutas estarían deshabilitadas
    // o requerirían autenticación adicional
    res.json({ 
      message: 'Seed data endpoint',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin seed route error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute seed operation'
      }
    });
  }
});

module.exports = router;