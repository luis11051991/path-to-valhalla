exports.validateRegister = (req, res, next) => {
  const errors = [];
  const { username, email, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 32) {
    errors.push('username_invalid');
  }

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email_invalid');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('password_invalid');
  }

  if (errors.length > 0) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Validación fallida.', details: errors } });
  }

  req.body.username = username.trim();
  req.body.email = email.toLowerCase();
  next();
};

exports.validateLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email_invalid');
  }

  if (!password || typeof password !== 'string' || password.length < 1) {
    errors.push('password_required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Validación fallida.', details: errors } });
  }

  req.body.email = email.toLowerCase();
  next();
};
