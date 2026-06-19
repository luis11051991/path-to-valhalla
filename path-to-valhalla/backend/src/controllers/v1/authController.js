const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const authService = require('../../services/authService');

const SECRET_KEY = env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const user = await authService.register(req.body);
    if (user.error) {
      const messages = {
        duplicate_user: 'El nombre o correo ya están en uso.',
        missing_data: 'Faltan datos obligatorios.'
      };
      return res.status(400).json({ ok: false, error: { code: 'AUTH_ERROR', message: messages[user.error] || user.error } });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({
      ok: true,
      data: {
        token,
        message: 'Cuenta creada. Elige tu destino.',
        user
      }
    });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error interno del servidor.' } });
  }
};

exports.login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    if (result.error) {
      return res.status(400).json({ ok: false, error: { code: 'AUTH_ERROR', message: 'Credenciales incorrectas.' } });
    }

    const token = jwt.sign({ id: result.user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({
      ok: true,
      data: {
        token,
        message: 'Regreso glorioso.',
        user: result.user
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error interno del servidor.' } });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await authService.getProfile(userId);

    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } });
    }

    res.json({ ok: true, data: { user } });
  } catch (err) {
    console.error('Error en getProfile:', err);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al obtener perfil.' } });
  }
};
