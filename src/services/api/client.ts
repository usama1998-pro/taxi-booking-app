import { apiDelete, apiGetJson, apiPatchJson, apiPostJson } from './apiFetch';

export const api = {
  get: <T>(path: string, token?: string) => {
    if (!token) {
      throw new Error('API get requires a token');
    }
    return apiGetJson<T>(path, token);
  },
  post: <T>(path: string, body: unknown, token?: string) =>
    apiPostJson<T>(path, body, token),
  patch: <T>(path: string, body: unknown, token?: string) => {
    if (!token) {
      throw new Error('API patch requires a token');
    }
    return apiPatchJson<T>(path, body, token);
  },
  delete: (path: string, token: string) => apiDelete(path, token),
};
