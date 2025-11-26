// server/index.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Configuración básica
app.use(cors());
app.use(express.json());

// Configuración de la Base de Datos
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Ruta de prueba para verificar conexión
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'success',
      message: '¡Conexión a Base de Datos exitosa!',
      time: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 'error',
      message: 'Error conectando a la base de datos',
      error: err.message
    });
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor corriendo en el puerto ${port}`);
});