const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',       // El usuario por defecto de Postgres
  host: 'localhost',      // Significa que la DB está en tu misma PC
  database: 'path-to-valhalla',   // El nombre de la base de datos (por defecto es postgres)
  password: '913082903', // <--- ¡CAMBIA ESTO POR TU CONTRASEÑA DE POSTGRES!
  port: 5432,             // El puerto estándar de Postgres
});

module.exports = pool;