import { buildApiUrl } from '../../constants/config';
import { parseJsonErrorBody } from '../../lib/apiErrors';
import { logger } from '../../lib/logger';

export class AuthRequestError extends Error {
  override readonly name = 'AuthRequestError';

  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type LoginResponse = {
  access_token: string;
  expires_in: number;
  expires_at: string;
};

export type VerifyResponse = {
  sub: string;
  email: string;
  typ: 'driver' | 'user';
  is_admin: boolean;
  tv: number;
  jti?: string;
  expires_in: number;
  expires_at: string;
};

export type DriverProfileDto = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  isAvailable?: boolean;
  isActive?: boolean;
};

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = parseJsonErrorBody(JSON.parse(text));
    if (parsed) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return text.trim() || `Request failed (${res.status})`;
}

async function jsonRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = buildApiUrl(path);
  logger.debug('Auth API request', { method: method ?? 'GET', path });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    logger.error('Auth API network failure', { path, error: raw });
    throw new AuthRequestError(
      raw || 'Network error',
      0,
      path,
    );
  }

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    logger.warn('Auth API HTTP error', { path, status: res.status, message: msg });
    throw new AuthRequestError(msg, res.status, path);
  }

  const raw = await res.text();
  if (!raw) {
    return undefined as T;
  }
  return JSON.parse(raw) as T;
}

export const authApi = {
  verifyCode(body: { code: string }): Promise<LoginResponse> {
    return jsonRequest<LoginResponse>('/auth/verify-code', {
      method: 'POST',
      body,
    });
  },

  verify(token: string): Promise<VerifyResponse> {
    return jsonRequest<VerifyResponse>('/auth/verify', { method: 'GET', token });
  },

  signOut(token: string): Promise<{ revoked: boolean }> {
    return jsonRequest<{ revoked: boolean }>('/auth/signout', {
      method: 'POST',
      token,
    });
  },

  fetchMyProfile(token: string): Promise<DriverProfileDto> {
    return jsonRequest<DriverProfileDto>('/drivers/me/profile', {
      method: 'GET',
      token,
    });
  },

  patchMyAvailability(
    token: string,
    isAvailable: boolean,
  ): Promise<{ isAvailable: boolean }> {
    return jsonRequest<{ isAvailable: boolean }>('/drivers/me/availability', {
      method: 'PATCH',
      body: { isAvailable },
      token,
    });
  },
};
