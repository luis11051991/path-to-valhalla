// Módulo de autenticación - punto de entrada para el módulo auth
const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');

// Exportar rutas y controlador
module.exports = {
  router,
  controller: AuthController
};