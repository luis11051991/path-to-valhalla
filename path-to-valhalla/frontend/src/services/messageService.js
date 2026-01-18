import { apiUrl } from '../constants/api';

const getToken = () => localStorage.getItem('token');
const getAuthHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'x-auth-token': token,
        'Authorization': `Bearer ${token}`
    };
};

export const messageService = {
    // Enviar mensaje
    sendMessage: async (recipientUsername, content) => {
        try {
            const res = await fetch(apiUrl('/api/messages/send'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ recipientUsername, content })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al enviar mensaje');
            return data;
        } catch (err) {
            throw err;
        }
    },

    // Obtener mis mensajes
    getMyMessages: async () => {
        try {
            const res = await fetch(apiUrl('/api/messages/'), {
                method: 'GET',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al obtener mensajes');
            return data;
        } catch (err) {
            throw err;
        }
    },

    // Marcar como leído
    markAsRead: async (messageId) => {
        try {
            const res = await fetch(apiUrl('/api/messages/read'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ messageId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al marcar leído');
            return data;
        } catch (err) {
            throw err;
        }
    },

    // NUEVO: Obtener contador de no leídos
    getUnreadCount: async () => {
        try {
            const res = await fetch(apiUrl('/api/messages/unread'), {
                method: 'GET',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error('Error counting');
            return data.count;
        } catch (err) {
            console.error(err);
            return 0;
        }
    },

    // Búsqueda de usuarios
    searchUsers: async (query) => {
        try {
            const res = await fetch(apiUrl(`/api/search-users?q=${query}`));
            return await res.json();
        } catch (err) {
            console.error(err);
            return [];
        }
    }
};
