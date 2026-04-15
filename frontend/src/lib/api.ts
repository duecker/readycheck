const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('rc_token');
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  get: (path: string) => request(path),
  patch: (path: string, body: any) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
