// Almacenamiento centralizado de tokens y sesión
export function getToken() {
  try {
    const token = localStorage.getItem('token');
    return token ? JSON.parse(token) : null;
  } catch (error) {
    console.error('Error reading token from localStorage:', error);
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem('token', JSON.stringify(token));
  } catch (error) {
    console.error('Error setting token in localStorage:', error);
  }
}

export function removeToken() {
  try {
    localStorage.removeItem('token');
  } catch (error) {
    console.error('Error removing token from localStorage:', error);
  }
}

export function getUser() {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error reading user from localStorage:', error);
    return null;
  }
}

export function setUser(user) {
  try {
    localStorage.setItem('user', JSON.stringify(user));
  } catch (error) {
    console.error('Error setting user in localStorage:', error);
  }
}

export function removeUser() {
  try {
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error removing user from localStorage:', error);
  }
}