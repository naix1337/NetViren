const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API Error');
  }
  return res.json();
}

export const api = {
  get: (path: string) => fetchApi(path),
  post: (path: string, body?: any) =>
    fetchApi(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: (path: string, body: any) =>
    fetchApi(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path: string, body: any) =>
    fetchApi(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => fetchApi(path, { method: 'DELETE' }),
  upload: async (path: string, formData: FormData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
