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
        throw new Error(data.message || 'Error en el servicio de logros.');
    }

    return data;
};

export const achievementService = {
    getAchievements: () => request('/api/achievements'),

    claimAchievement: (id) => request(`/api/achievements/${id}/claim`, {
        method: 'POST'
    }),

    claimAllAchievements: () => request('/api/achievements/claim-all', {
        method: 'POST'
    }),

    updateProgress: (type, amount = 1, metadata = {}) => request('/api/achievements/progress', {
        method: 'POST',
        body: JSON.stringify({ type, amount, metadata })
    })
};
