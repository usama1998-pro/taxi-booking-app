import { API_BASE_URL } from '../constants/config';

/** Shared fetch headers (includes ngrok bypass when using a tunnel URL). */
export function buildApiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  if (API_BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  return headers;
}
