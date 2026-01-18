const pool = require('../src/config/db');

const createMessagesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id UUID REFERENCES players(id),
        recipient_id UUID REFERENCES players(id),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
    console.log("✅ Tabla 'messages' creada o verificada correctamente.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creando tabla messages:", err);
    process.exit(1);
  }
};

createMessagesTable();
