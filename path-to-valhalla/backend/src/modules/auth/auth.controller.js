// Controlador de autenticación - separa HTTP del dominio de negocio

const AuthService = require('./services/auth.service');

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  static async register(req, res) {
    try {
      const { username, email, password } = req.body;
      const result = await AuthService.register(username, email, password);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getProfile(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const profile = await AuthService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  static async updateProfile(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const profileData = req.body;
      const updatedProfile = await AuthService.updateProfile(userId, profileData);
      res.json(updatedProfile);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async logout(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      await AuthService.logout(userId);
      res.json({ message: 'Successfully logged out' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AuthController;