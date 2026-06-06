import { API_BASE_URL } from '../../constants/config';
import { ApiRequestError, readResponseErrorMessage } from '../../lib/apiErrors';
import { buildApiHeaders } from '../../lib/apiHeaders';
import { logger } from '../../lib/logger';
import { notifyUnauthorized } from './apiSession';

/** Avoid hanging forever on slow booking create / email backends. */
const API_REQUEST_TIMEOUT_MS = 90_000;

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  publicRequest?: boolean;
};

async function apiRequest(path: string, options: FetchOptions = {}): Promise<Response> {
  const { method = 'GET', body, token, publicRequest } = options;
  const url = `${API_BASE_URL}${path}`;

  const headers = buildApiHeaders({
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  logger.debug('API request', { method, path, public: publicRequest ?? false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const aborted = e instanceof Error && e.name === 'AbortError';
    logger.warn('API network failure', { path, error: raw, aborted });
    throw new ApiRequestError(
      aborted ? 'The request timed out. Please try again.' : raw || 'Network error',
      0,
      path,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const msg = await readResponseErrorMessage(res);
    logger.warn('API HTTP error', { path, status: res.status, message: msg });
    if (res.status === 401 && token) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(msg, res.status, path);
  }

  return res;
}

export async function apiGetJson<T>(path: string, token: string): Promise<T> {
  const res = await apiRequest(path, { token });
  return (await res.json()) as T;
}

export async function apiPostJson<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await apiRequest(path, { method: 'POST', body, token, publicRequest: !token });
  const raw = await res.text();
  if (!raw) {
    return undefined as T;
  }
  return JSON.parse(raw) as T;
}

export async function apiPatchJson<T>(
  path: string,
  body: unknown,
  token: string,
): Promise<T> {
  const res = await apiRequest(path, { method: 'PATCH', body, token });
  const raw = await res.text();
  if (!raw) {
    return undefined as T;
  }
  return JSON.parse(raw) as T;
}

export async function apiDelete(path: string, token: string): Promise<void> {
  await apiRequest(path, { method: 'DELETE', token });
}
