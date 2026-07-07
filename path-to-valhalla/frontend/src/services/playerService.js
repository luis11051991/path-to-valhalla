import { apiUrl } from '../constants/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { 'x-auth-token': token };
};

const request = async (path) => {
    const response = await fetch(apiUrl(path), { headers: getAuthHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'Error en el servicio de jugadores.');
    }
    return data;
};

const playerService = {
    getPublicProfile: (playerId) => request(`/api/players/${playerId}/public-profile`)
};

export default playerService;
