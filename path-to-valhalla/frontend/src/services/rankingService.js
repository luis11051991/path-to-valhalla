import { apiUrl } from '../constants/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'x-auth-token': token
  };
};

export const rankingService = {
  getHeroes: (page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    return fetch(apiUrl(`/api/rankings/heroes?${params}`), {
      headers: getAuthHeaders()
    }).then(r => r.json());
  },

  getAlliances: (page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    return fetch(apiUrl(`/api/rankings/alliances?${params}`), {
      headers: getAuthHeaders()
    }).then(r => r.json());
  }
};
