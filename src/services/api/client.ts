import { API_BASE_URL } from '../../constants/config';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: unknown; token?: string } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: 'GET', token }),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'PATCH', body, token }),
};
