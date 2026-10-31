import Constants from 'expo-constants';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** FastAPI server-side API version prefix (no trailing slash). */
export const API_V1_PREFIX = '/api/v1';

/**
 * API origin (no trailing slash).
 * `.env` `EXPO_PUBLIC_BASE_API_URL` is inlined into the bundle, so it wins over
 * `extra.BASE_API_URL` (that value is baked when the dev client is built).
 * Default local dev targets the FastAPI server-side on port 8000.
 */
export const API_BASE_URL = normalizeBaseUrl(
  firstNonEmpty(
    process.env.EXPO_PUBLIC_BASE_API_URL,
    Constants.expoConfig?.extra?.BASE_API_URL,
  ) ?? 'http://localhost:8000',
);

/** Build a full URL for a versioned API path such as `/auth/signin`. */
export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_V1_PREFIX}${normalized}`;
}
