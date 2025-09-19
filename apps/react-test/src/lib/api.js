export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const hasBody = options.body != null;
  const headers = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
  if (!res.ok) {
    const message = isJson ? data?.error?.message || JSON.stringify(data) : String(data);
    const err = new Error(message || `HTTP ${res.status}`);
    // attach extra info for callers
    err.status = res.status;
    err.data = isJson ? data : { raw: data };
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/v1/me'),
  guilds: () => request('/v1/guilds'),
  logout: () => request('/v1/auth/logout', { method: 'POST' }),
  health: () => request('/v1/health'),
  getGuildConfig: (guildId) => request(`/v1/guilds/${guildId}/config`),
  updateGuildConfig: (guildId, config) => request(`/v1/guilds/${guildId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config)
  })
};
