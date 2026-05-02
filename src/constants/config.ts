import Constants from 'expo-constants';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

const fromExtra = Constants.expoConfig?.extra?.BASE_API_URL;

/**
 * Nest API base URL (no trailing slash), from `.env` → `app.config.js` → `extra.BASE_API_URL`.
 * Fallback is for rare cases where `expo-constants` has not been populated yet.
 */
export const API_BASE_URL = normalizeBaseUrl(
  typeof fromExtra === 'string' && fromExtra.length > 0
    ? fromExtra
    : 'http://localhost:3000',
);
