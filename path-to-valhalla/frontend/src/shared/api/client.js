// Cliente HTTP centralizado para todas las llamadas al backend
import { getToken } from '../auth/tokenStorage.js';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Configuración de interceptores
const apiClient = {
  // Método genérico para llamadas HTTP
  async request(endpoint, options = {}) {
    const token = getToken();
    
    // Configurar headers por defecto
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Añadir token si está presente
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
      headers: defaultHeaders,
      ...options
    };
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      
      // Manejo de errores HTTP
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Manejar automáticamente logout en caso de token inválido
        if (response.status === 401) {
          // Limpiar sesion y redirigir a login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
        
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  },
  
  // Métodos HTTP específicos
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },
  
  post(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(data) 
    });
  },
  
  put(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(data) 
    });
  },
  
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
};

export default apiClient;