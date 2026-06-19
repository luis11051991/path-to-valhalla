const bcrypt = require('bcryptjs');
const repository = require('../repositories/authRepository');

exports.register = async ({ username, email, password }) => {
  if (!username || !email || !password) {
    return { error: 'missing_data' };
  }

  const safeEmail = email.toLowerCase();

  if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return { error: 'invalid_username' };
  }

  if (typeof safeEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
    return { error: 'invalid_email' };
  }

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'weak_password' };
  }

  const user = await repository.createUser({ username: username.trim(), email: safeEmail, password });
  if (user.error === 'duplicate_user') {
    return { error: 'user_exists' };
  }

  return user;
};

exports.login = async ({ email, password }) => {
  if (!email || !password) {
    return { error: 'missing_credentials' };
  }

  const user = await repository.findUserByEmail(email);
  if (!user) {
    return { error: 'invalid_credentials' };
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return { error: 'invalid_credentials' };
  }

  let hydratedUser = await require('../shared/player_stats').hydratePlayer(user);

  hydratedUser.real_inventory = [];
  hydratedUser.active_background_url = hydratedUser.active_background_url || '';
  hydratedUser.rented_bags = [];

  return { error: null, user: hydratedUser };
};

exports.getProfile = async (userId) => {
  const user = await repository.findUserById(userId);
  if (!user) return null;

  let hydratedUser = await require('../shared/player_stats').hydratePlayer(user);

  hydratedUser.real_inventory = [];
  hydratedUser.active_background_url = user.active_background_url || '';
  hydratedUser.rented_bags = [];

  return hydratedUser;
};
