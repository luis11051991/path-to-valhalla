// Hook personalizado para manejar autenticación
import { useState, useEffect } from 'react';
import AuthService from '../services/auth.service';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Inicializar el servicio
  const authService = new AuthService(window.apiClient); // Usar el cliente HTTP global

  useEffect(() => {
    // Verificar si hay token en localStorage al cargar la aplicación
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Obtener perfil del usuario si es necesario
      fetchUserProfile();
    } else {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile.user);
      setIsLoading(false);
    } catch (error) {
      // Si falla obtener perfil, remover token y marcar como no autenticado
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setIsLoading(false);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      setUser(result.data.user);
      setIsAuthenticated(true);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const result = await authService.register(username, email, password);
      setUser(result.data.user);
      setIsAuthenticated(true);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    authService
  };
};

export default useAuth;