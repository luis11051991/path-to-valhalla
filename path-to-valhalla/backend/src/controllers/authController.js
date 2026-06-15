// Controlador de autenticación - separa HTTP del dominio de negocio
const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const bcrypt = require('bcryptjs');

// Servicio para operaciones de autenticación (separado del controlador)
class AuthService {
  static async login(email, password) {
    // Esta sería la lógica con conexión a Firestore/DB
    // Por ahora es solo una implementación base

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Simulamos proceso de verificación
    const user = {
      id: 'user-123',
      email,
      username: 'test-user',
      role: 'user'
    };

    return { user, token: 'fake-jwt-token' };
  }

  static async register(username, email, password) {
    // Lógica de registro
    if (!username || !email || !password) {
      throw new Error('All fields are required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Simulamos registro de usuario en BD
    const user = {
      id: 'user-456',
      username,
      email,
      role: 'user'
    };

    return { user, token: 'fake-jwt-token' };
  }
}

// Controlador HTTP para rutas
const authController = {
  // Login de usuario
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Ejecutar lógica de negocio en el servicio
      const result = await AuthService.login(email, password);

      // Devolver respuesta HTTP
      res.json({
        data: result.user,
        token: result.token,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        error: {
          code: 'AUTH_FAILED',
          message: error.message || 'Authentication failed'
        }
      });
    }
  },

  // Registro de usuario
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Ejecutar lógica de negocio en el servicio
      const result = await AuthService.register(username, email, password);

      // Devolver respuesta HTTP
      res.status(201).json({
        data: result.user,
        token: result.token,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message || 'Registration failed'
        }
      });
    }
  },

  // Obtener perfil del usuario
  async getProfile(req, res) {
    try {
      const user = req.user; // Ya autenticado por middleware

      res.json({
        data: user,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch profile'
        }
      });
    }
  },

  // Actualizar perfil del usuario
  async updateProfile(req, res) {
    try {
      const user = req.user;

      // Aquí iría la lógica para actualizar el perfil en BD

      res.json({
        data: { ...user, ...req.body },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile'
        }
      });
    }
  },

  // Cerrar sesión
  async logout(req, res) {
    try {
      // Aquí iría la lógica para invalidar token

      res.json({
        message: 'Successfully logged out',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to logout'
        }
      });
    }
  },

  // Login con Firebase
  async firebaseLogin(req, res) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Firebase ID token is required'
          }
        });
      }

      // Verificar el token con Firebase Admin
      const decodedToken = await verifyFirebaseToken(idToken);

      // Aquí iría la lógica para crear o encontrar un usuario en la base de datos
      // Por ahora, simulamos la creación de un usuario
      const user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        username: decodedToken.displayName || decodedToken.email.split('@')[0],
        role: 'user',
        firebaseUid: decodedToken.uid
      };

      // Generar token JWT para la sesión local
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        data: {
          user,
          token
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Firebase login error:', error);
      res.status(401).json({
        error: {
          code: 'FIREBASE_LOGIN_FAILED',
          message: error.message || 'Firebase authentication failed'
        }
      });
    }
  }
};

module.exports = authController;
