import { apiUrl } from '../constants/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'x-auth-token': token
    };
};

const request = async (path, options = {}) => {
    const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'Error en el servicio de estadisticas.');
    }

    return data;
};

export const statisticsService = {
    getStatistics: () => request('/api/statistics')
};
