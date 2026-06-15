// Servicio de autenticación para frontend - contiene lógica de negocio
class AuthService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async login(email, password) {
    try {
      const response = await this.apiClient.post('/auth/login', {
        email,
        password
      });
      
      if (response.data && response.data.token) {
        // Guardar token en localStorage
        localStorage.setItem('token', response.data.token);
        return response.data;
      }
      
      throw new Error(response.message || 'Login failed');
    } catch (error) {
      throw error;
    }
  }

  async register(username, email, password) {
    try {
      const response = await this.apiClient.post('/auth/register', {
        username,
        email,
        password
      });
      
      if (response.data && response.data.token) {
        // Guardar token en localStorage
        localStorage.setItem('token', response.data.token);
        return response.data;
      }
      
      throw new Error(response.message || 'Registration failed');
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      // Eliminar token del localStorage
      localStorage.removeItem('token');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async getProfile() {
    try {
      const response = await this.apiClient.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await this.apiClient.put('/auth/profile', profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  isAuthenticated() {
    const token = localStorage.getItem('token');
    return !!token;
  }
}

module.exports = AuthService;