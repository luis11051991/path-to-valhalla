import { apiUrl } from "../constants/api";

const getAuthHeaders = (extraHeaders = {}) => {
  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    ...extraHeaders,
  };

  Object.keys(headers).forEach((key) => {
    if (headers[key] === undefined) {
      delete headers[key];
    }
  });

  return headers;
};

const parseJson = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Error de mensajeria.");
  }

  return data;
};

const getUnreadCount = async () => {
  const response = await fetch(apiUrl("/api/messages/unread"), {
    headers: getAuthHeaders(),
  });
  const data = await parseJson(response);
  return data.count ?? 0;
};

const sendMessage = async (recipientUsername, content) => {
  const response = await fetch(apiUrl("/api/messages/send"), {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ recipientUsername, content }),
  });

  return parseJson(response);
};

const markAsRead = async (messageId) => {
  const response = await fetch(apiUrl("/api/messages/read"), {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ messageId }),
  });

  return parseJson(response);
};

const searchUsers = async (queryStr) => {
  const trimmed = queryStr.trim();

  if (trimmed.length < 3) {
    return [];
  }

  const response = await fetch(apiUrl(`/api/search-users?q=${encodeURIComponent(trimmed)}`), {
    headers: getAuthHeaders({ "Content-Type": undefined }),
  });

  const data = await parseJson(response);
  return Array.isArray(data) ? data : [];
};

const getMyMessages = async () => {
  const response = await fetch(apiUrl("/api/messages"), {
    headers: getAuthHeaders({ "Content-Type": undefined }),
  });

  return parseJson(response);
};

export const messageService = {
  sendMessage,
  markAsRead,
  getUnreadCount,
  searchUsers,
  getMyMessages,
};
