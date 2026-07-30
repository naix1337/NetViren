async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    const res = await fetch(path, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
