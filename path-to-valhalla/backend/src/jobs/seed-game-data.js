// Script para ejecución de datos iniciales (seed)
const { ensureInitialGameData } = require('../seeds/bootstrap');

async function runSeed() {
  try {
    console.log('Starting seed data initialization...');
    
    await ensureInitialGameData();
    
    console.log('Seed data initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing seed data:', error.message);
    process.exit(1);
  }
}

// Solo ejecutar si el script se llama directamente
if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };