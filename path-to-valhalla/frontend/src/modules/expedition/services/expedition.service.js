// Servicio para gestionar expediciones en el frontend
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Configurar instancia de Axios con base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor para agregar el token de autenticación si existe
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Obtener todas las expediciones
export const getExpeditions = async () => {
  try {
    const response = await api.get('/expeditions');
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch expeditions: ${error.message}`);
  }
};

// Obtener una expedición específica por ID
export const getExpedition = async (expeditionId) => {
  try {
    const response = await api.get(`/expeditions/${expeditionId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch expedition: ${error.message}`);
  }
};

// Crear una nueva expedición
export const createExpedition = async (expeditionData) => {
  try {
    const response = await api.post('/expeditions', expeditionData);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create expedition: ${error.message}`);
  }
};

// Unirse a una expedición
export const joinExpedition = async (expeditionId) => {
  try {
    const response = await api.post(`/expeditions/${expeditionId}/join`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to join expedition: ${error.message}`);
  }
};

// Salir de una expedición
export const leaveExpedition = async (expeditionId) => {
  try {
    const response = await api.delete(`/expeditions/${expeditionId}/leave`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to leave expedition: ${error.message}`);
  }
};

// Actualizar estado de una expedición
export const updateExpeditionStatus = async (expeditionId, status) => {
  try {
    const response = await api.put(`/expeditions/${expeditionId}/status`, { status });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update expedition status: ${error.message}`);
  }
};

// Completar una expedición
export const completeExpedition = async (expeditionId) => {
  try {
    const response = await api.post(`/expeditions/${expeditionId}/complete`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to complete expedition: ${error.message}`);
  }
};

// Cancelar una expedición
export const cancelExpedition = async (expeditionId) => {
  try {
    const response = await api.post(`/expeditions/${expeditionId}/cancel`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to cancel expedition: ${error.message}`);
  }
};

// Obtener expediciones públicas
export const getPublicExpeditions = async () => {
  try {
    const response = await api.get('/expeditions/public');
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch public expeditions: ${error.message}`);
  }
};

export default {
  getExpeditions,
  getExpedition,
  createExpedition,
  joinExpedition,
  leaveExpedition,
  updateExpeditionStatus,
  completeExpedition,
  cancelExpedition,
  getPublicExpeditions
};