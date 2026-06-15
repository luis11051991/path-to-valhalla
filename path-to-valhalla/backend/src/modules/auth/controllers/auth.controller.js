// Controlador de autenticación - maneja solicitudes HTTP
const AuthService = require('../services/auth.service');

class AuthController {
  // Método para login
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      // Validar entrada
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Autenticar usuario
      const result = await AuthService.login(email, password);
      
      // Enviar respuesta con token
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            created_at: result.user.created_at
          },
          token: result.token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Método para registro
  static async register(req, res, next) {
    try {
      const { username, email, password } = req.body;
      
      // Validar entrada
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email and password are required'
        });
      }

      const result = await AuthService.register(username, email, password);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            created_at: result.user.created_at
          },
          token: result.token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Método para obtener perfil
  static async getProfile(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profile = await AuthService.getProfile(userId);
      
      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            created_at: profile.created_at,
            race: profile.race,
            gender: profile.gender,
            class_id: profile.class_id,
            tier: profile.tier,
            level: profile.level,
            gold: profile.gold,
            silver: profile.silver,
            copper: profile.copper,
            onix: profile.onix,
            current_hp: profile.current_hp,
            energy: profile.energy,
            valor: profile.valor,
            stats: profile.stats
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Método para actualizar perfil
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profileData = req.body;
      
      // Validar campos permitidos
      const allowedFields = [
        'username', 'email', 'password', 
        'race', 'gender', 'class_id'
      ];
      
      const filteredData = {};
      Object.keys(profileData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = profileData[key];
        }
      });

      // Si se proporciona password, hashearlo
      if (filteredData.password) {
        const salt = await bcrypt.genSalt(10);
        filteredData.password_hash = await bcrypt.hash(filteredData.password, salt);
        delete filteredData.password;
      }

      const updatedProfile = await AuthService.updateProfile(userId, filteredData);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedProfile.id,
            username: updatedProfile.username,
            email: updatedProfile.email,
            created_at: updatedProfile.created_at,
            race: updatedProfile.race,
            gender: updatedProfile.gender,
            class_id: updatedProfile.class_id,
            tier: updatedProfile.tier,
            level: updatedProfile.level,
            gold: updatedProfile.gold,
            silver: updatedProfile.silver,
            copper: updatedProfile.copper,
            onix: updatedProfile.onix,
            current_hp: updatedProfile.current_hp,
            energy: updatedProfile.energy,
            valor: updatedProfile.valor,
            stats: updatedProfile.stats
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Método para logout
  static async logout(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      await AuthService.logout(userId);
      
      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;