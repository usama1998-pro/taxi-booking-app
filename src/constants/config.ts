import Constants from 'expo-constants';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

const fromExtra = Constants.expoConfig?.extra?.BASE_API_URL;

/** FastAPI server-side API version prefix (no trailing slash). */
export const API_V1_PREFIX = '/api/v1';

/**
 * API origin (no trailing slash), from `.env` → `app.config.js` → `extra.BASE_API_URL`.
 * Default local dev targets the FastAPI server-side on port 8000.
 */
export const API_BASE_URL = normalizeBaseUrl(
  typeof fromExtra === 'string' && fromExtra.length > 0
    ? fromExtra
    : 'http://localhost:8000',
);

/** Build a full URL for a versioned API path such as `/auth/signin`. */
export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_V1_PREFIX}${normalized}`;
}
