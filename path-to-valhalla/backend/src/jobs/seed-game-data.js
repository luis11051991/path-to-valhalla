#!/usr/bin/env node

// Script para ejecutar seed de datos iniciales
require('dotenv').config();
const { ensureInitialGameData } = require('../seeds/bootstrap');
const { isInitialized } = require('../config/db');

async function runSeed() {
  // Validar que Firebase se haya inicializado correctamente
  if (!isInitialized()) {
    console.error('Firebase initialization failed. Exiting.');
    process.exit(1);
  }

  try {
    console.log('Starting initial game data seeding...');
    await ensureInitialGameData();
    console.log('Initial game data loaded successfully');
    process.exit(0);
  } catch (error) {
    console.error('[seed] Error loading initial data:', error.message);
    process.exit(1);
  }
}

runSeed();