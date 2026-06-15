// Aplicación Express principal
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFoundMiddleware } = require('./middlewares/not-found.middleware');

// Configurar limitador de tasa
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutos por defecto
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 peticiones por defecto
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configuración CORS según variables de entorno
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()) : 
    ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};

const app = express();

// Middlewares globales
app.use(helmet()); // Protección de headers HTTP
app.use(cors(corsOptions)); // Configuración CORS
app.use(limiter); // Limitador de tasa
app.use(express.json({ limit: '10mb' })); // Límite de tamaño del body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Importar rutas
const routes = require('./routes/index.js');

// Montar rutas
app.use('/api', routes);

// Middleware para manejo de errores
app.use(errorMiddleware);

// Middleware para rutas no encontradas
app.use(notFoundMiddleware);

module.exports = app;