const REQUIRED = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];

function loadEnv() {
  try {
    const dotenv = require('dotenv');
    dotenv.config();

    for (const key of REQUIRED) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
  } catch (err) {
    console.error('[env] Error loading configuration:', err.message);
    process.exit(1);
  }
}

loadEnv();

module.exports = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,

  PGHOST: process.env.PGHOST,
  PGPORT: parseInt(process.env.PGPORT, 10) || 5432,
  PGDATABASE: process.env.PGDATABASE,
  PGUSER: process.env.PGUSER,
  PGPASSWORD: process.env.PGPASSWORD,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN,
};
