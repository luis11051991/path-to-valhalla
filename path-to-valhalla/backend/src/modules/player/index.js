// Módulo de jugador - punto de entrada para el módulo player
const express = require('express');
const router = express.Router();
const PlayerController = require('./player.controller');

// Exportar rutas y controlador
module.exports = {
  router,
  controller: PlayerController
};