const pool = require('./pool');

/**
 * Ejecuta una funcion dentro de una transaccion de base de datos.
 * Si fn lanza, la transaccion se revierte automaticamente.
 */
async function transaction(fn) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = transaction;
