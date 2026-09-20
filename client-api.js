// Optional helper for the Vue frontend.
// Import this file from src/lib/api.ts if you want a typed service layer.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('nova-token');
}

export function setToken(token) {
  localStorage.setItem('nova-token', token);
}

export function clearToken() {
  localStorage.removeItem('nova-token');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
