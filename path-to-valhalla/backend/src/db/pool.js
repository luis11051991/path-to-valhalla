const { Pool } = require('pg');
const env = require('../config/env');

// Preferir DATABASE_URL si esta disponible, sino usar variables PG_*
let connectionString;
if (env.DATABASE_URL) {
  connectionString = env.DATABASE_URL;
} else if (env.PGHOST && env.PGDATABASE && env.PGUSER) {
  connectionString = `postgresql://${env.PGUSER}:${encodeURIComponent(env.PGPASSWORD || '')}@${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`;
} else {
  throw new Error('No se pudo configurar la conexión de base de datos. Verifica DATABASE_URL o las variables PG*.');
}

const pool = new Pool({ connectionString });

module.exports = pool;
