const { Pool } = require('pg');
require('dotenv').config();

const REQUIRED_DB_ENV = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = REQUIRED_DB_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(' Faltan variables de entorno obligatorias para PostgreSQL:');
  console.error(`   ${missing.join(', ')}`);
  console.error('   Revisa tu archivo .env.local o .env.server.');
  console.error('   Ejecuta: npm run dev:local  (base local)  o  npm run dev:server  (base remota ZeroTier).');
  process.exit(1);
}

const port = Number(process.env.DB_PORT);
if (Number.isNaN(port)) {
  console.error('DB_PORT no es un número válido.');
  process.exit(1);
}

const config = {
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 10000,
};

config.ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

pool.connect((err, client, done) => {
  if (err) {
    console.error(' No se pudo conectar a PostgreSQL.');
    console.error(`   host: ${config.host}`);
    console.error(`   puerto: ${config.port}`);
    console.error(`   base: ${config.database}`);
    console.error(`   usuario: ${config.user}`);
    console.error(`   error: ${err.message}`);
    process.exit(1);
  }

  client.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()', (qErr, result) => {
    if (qErr) {
      console.error(`   La conexión abrió pero falló la verificación inicial: ${qErr.message}`);
    } else {
      const row = result.rows[0];
      console.log(' PostgreSQL conectado:');
      console.log(`   base: ${row.current_database} | usuario: ${row.current_user}`);
      console.log(`   servidor: ${row.inet_server_addr || 'N/A'} | puerto: ${row.inet_server_port || 'N/A'}`);
    }
    done();
  });
});

module.exports = pool;
