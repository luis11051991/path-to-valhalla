// Configuración de variables de entorno y validación
const validateEnv = () => {
  const requiredVars = [
    'JWT_SECRET',
    'ALLOWED_ORIGINS'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('Missing required environment variables:', missingVars);
    return false;
  }

  // Validar JWT_SECRET
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters long');
    return false;
  }

  return true;
};

const envConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  allowedOrigins: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()) : 
    ['*'],
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = {
  validateEnv,
  envConfig
};