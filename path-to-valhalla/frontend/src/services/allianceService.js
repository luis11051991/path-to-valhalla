import { apiUrl } from '../constants/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'x-auth-token': token
    };
};

const buildQuery = (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        searchParams.set(key, value);
    });
    const query = searchParams.toString();
    return query ? `?${query}` : '';
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
        throw new Error(data.message || 'Error en el servicio de alianzas.');
    }

    return data;
};

export const allianceService = {
    getMyAlliance: () => request('/api/alliances/me'),
    listAlliances: (params = {}) => request(`/api/alliances${buildQuery(params)}`),
    getAlliancePublicProfile: (id) => request(`/api/alliances/${id}`),
    createAlliance: (payload) => request('/api/alliances', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    applyToAlliance: (allianceId, message) => request(`/api/alliances/${allianceId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ message })
    }),
    getApplications: (allianceId) => request(`/api/alliances/${allianceId}/applications`),
    acceptApplication: (applicationId) => request(`/api/alliances/applications/${applicationId}/accept`, {
        method: 'POST'
    }),
    rejectApplication: (applicationId) => request(`/api/alliances/applications/${applicationId}/reject`, {
        method: 'POST'
    }),
    donate: (payload) => request('/api/alliances/donate', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    getDonationInfo: () => request('/api/alliances/me/donations'),
    upgradeBuilding: (buildingId) => request(`/api/alliances/buildings/${buildingId}/upgrade`, {
        method: 'POST'
    }),
    getJudgements: () => request('/api/alliances/judgements'),
    getEligibleJudgementMembers: () => request('/api/alliances/judgements/eligible-members'),
    startJudgement: (payload) => request('/api/alliances/judgements', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    voteJudgement: (judgementId, vote) => request(`/api/alliances/judgements/${judgementId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote })
    }),
    resolveJudgement: (judgementId) => request(`/api/alliances/judgements/${judgementId}/resolve`, {
        method: 'POST'
    }),
    getMembers: () => request('/api/alliances/me/members'),
    promoteMember: (memberId) => request(`/api/alliances/members/${memberId}/promote`, {
        method: 'POST'
    }),
    demoteMember: (memberId) => request(`/api/alliances/members/${memberId}/demote`, {
        method: 'POST'
    }),
    kickMember: (memberId) => request(`/api/alliances/members/${memberId}`, {
        method: 'DELETE'
    }),
    leaveAlliance: () => request('/api/alliances/leave', {
        method: 'POST'
    }),
    updateSettings: (payload) => request('/api/alliances/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    }),
    transferLeadership: (playerId) => request('/api/alliances/transfer-leadership', {
        method: 'POST',
        body: JSON.stringify({ newLeaderPlayerId: playerId })
    }),
    disbandAlliance: () => request('/api/alliances/me', {
        method: 'DELETE'
    })
};
