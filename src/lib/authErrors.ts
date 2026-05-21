import {
  SYSTEM_DOWN_MESSAGE,
  friendlyFromServerMessage,
  isInternalServerStatus,
  isNetworkFailureMessage,
} from './apiErrors';
import { AuthRequestError } from '../services/auth/authApi';

type AuthUiContext = 'verification';

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function friendlyAuthFromServerMessage(msg: string, _context: AuthUiContext): string | null {
  const m = msg.trim();
  if (!m) {
    return null;
  }

  if (includesAny(m, ['invalid verification code', 'invalid code', 'wrong code'])) {
    return 'That code is not valid. Please check the 4-digit code and try again.';
  }
  if (includesAny(m, ['driver account is disabled', 'account is disabled'])) {
    return 'This driver account is disabled. Contact support if you need help.';
  }
  if (includesAny(m, ['forbidden', 'only drivers can access'])) {
    return 'You do not have access to the driver app with this account.';
  }
  if (isNetworkFailureMessage(m)) {
    return 'Could not reach the server. Check your connection and API address in settings.';
  }

  return friendlyFromServerMessage(m);
}

function byStatus(status: number, serverMsg: string, context: AuthUiContext): string {
  switch (status) {
    case 0:
      return (
        friendlyAuthFromServerMessage(serverMsg, context) ??
        'Could not reach the server. Check Wi-Fi or mobile data, and that BASE_API_URL points to your API.'
      );
    case 400:
      return 'Please enter a valid 4-digit verification code and try again.';
    case 401:
      return friendlyAuthFromServerMessage(serverMsg, context) ?? 'The verification code is incorrect.';
    case 403:
      return (
        friendlyAuthFromServerMessage(serverMsg, context) ??
        'You are not allowed to do that with this account.'
      );
    case 404:
      return 'The server could not find what it needed. If this keeps happening, contact support.';
    case 409:
      return friendlyAuthFromServerMessage(serverMsg, context) ?? 'This code can no longer be used.';
    case 422:
      return 'Some information is not valid. Review the form and try again.';
    case 429:
      return 'Too many attempts. Please wait a minute and try again.';
    case 500:
    case 502:
    case 503:
      return SYSTEM_DOWN_MESSAGE;
    default:
      if (isInternalServerStatus(status)) {
        return SYSTEM_DOWN_MESSAGE;
      }
      return (
        friendlyAuthFromServerMessage(serverMsg, context) ??
        'Could not verify your code. Please try again.'
      );
  }
}

/** Maps API / network errors to a short message suitable for on-screen display. */
export function getAuthUiMessage(error: unknown, context: AuthUiContext): string {
  if (error instanceof AuthRequestError) {
    if (!isInternalServerStatus(error.status)) {
      const fromServer = friendlyAuthFromServerMessage(error.message, context);
      if (fromServer) {
        return fromServer;
      }
    }
    return byStatus(error.status, error.message, context);
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (isNetworkFailureMessage(msg)) {
      return 'Could not reach the server. Check Wi‑Fi or mobile data, and that BASE_API_URL points to your machine.';
    }
    const fromServer = friendlyAuthFromServerMessage(msg, context);
    if (fromServer) {
      return fromServer;
    }
    if (msg.length > 0 && msg.length < 180 && !msg.startsWith('{')) {
      return msg;
    }
  }

  return 'Could not verify your code. Please try again.';
}
