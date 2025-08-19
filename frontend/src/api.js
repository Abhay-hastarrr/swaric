export async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    credentials: 'include',
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  if (!response.ok) {
    const errorPayload = isJson ? await response.json().catch(() => ({})) : { message: await response.text() };
    const err = new Error(errorPayload.message || 'Request failed');
    err.status = response.status;
    err.payload = errorPayload;
    throw err;
  }
  return isJson ? response.json() : response.text();
}

export const AuthAPI = {
  signup: (data) => apiFetch('/api/auth/signup', { method: 'POST', body: data }),
  login: (data) => apiFetch('/api/auth/login', { method: 'POST', body: data }),
  me: () => apiFetch('/api/auth/me'),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
};


