// Configuración de CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()) : 
    ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = { corsOptions };