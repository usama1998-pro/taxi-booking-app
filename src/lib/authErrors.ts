import { AuthRequestError } from '../services/auth/authApi';

type AuthUiContext = 'signIn' | 'signUp';

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function friendlyFromServerMessage(msg: string, context: AuthUiContext): string | null {
  const m = msg.trim();
  if (!m) {
    return null;
  }

  if (includesAny(m, ['invalid email or password', 'invalid credentials'])) {
    return 'That email or password is not correct. Please try again.';
  }
  if (includesAny(m, ['driver account is disabled', 'account is disabled'])) {
    return 'This driver account is disabled. Contact support if you need help.';
  }
  if (includesAny(m, ['passenger accounts cannot sign in', 'drivers only', 'driver account'])) {
    return 'This app is for drivers only. Use a driver email and password, or create a driver account.';
  }
  if (includesAny(m, ['email or phone is already registered', 'already registered', 'unique constraint'])) {
    return 'That email or phone number is already in use. Try signing in or use different details.';
  }
  if (includesAny(m, ['token is no longer valid', 'sign in again'])) {
    return 'Your session expired. Please sign in again.';
  }
  if (includesAny(m, ['forbidden', 'only drivers can access'])) {
    return 'You do not have access to the driver app with this account.';
  }
  if (includesAny(m, ['network', 'failed to fetch', 'network request failed'])) {
    return 'Could not reach the server. Check your connection and API address in settings.';
  }

  if (context === 'signUp' && m.length < 200 && !m.includes('{')) {
    return m;
  }
  if (context === 'signIn' && m.length < 200 && !m.includes('{')) {
    return m;
  }

  return null;
}

function byStatus(status: number, serverMsg: string, context: AuthUiContext): string {
  switch (status) {
    case 0:
      return (
        friendlyFromServerMessage(serverMsg, context) ??
        'Could not reach the server. Check Wi-Fi or mobile data, and that BASE_API_URL points to your API.'
      );
    case 400:
      return context === 'signUp'
        ? 'Please check your details: use a valid email, phone, and a password of at least 8 characters.'
        : 'Something was wrong with your request. Check email and password and try again.';
    case 401:
      return (
        friendlyFromServerMessage(serverMsg, context) ??
        'We could not sign you in. Check your email and password.'
      );
    case 403:
      return (
        friendlyFromServerMessage(serverMsg, context) ??
        'You are not allowed to do that with this account.'
      );
    case 404:
      return 'The server could not find what it needed. If this keeps happening, contact support.';
    case 409:
      return (
        friendlyFromServerMessage(serverMsg, context) ??
        'That email or phone is already registered. Try signing in instead.'
      );
    case 422:
      return 'Some information is not valid. Review the form and try again.';
    case 429:
      return 'Too many attempts. Please wait a minute and try again.';
    case 500:
    case 502:
    case 503:
      return 'The server is having trouble right now. Please try again in a few minutes.';
    default:
      if (status >= 500) {
        return 'Something went wrong on the server. Please try again later.';
      }
      return (
        friendlyFromServerMessage(serverMsg, context) ??
        (context === 'signIn'
          ? 'Could not sign in. Please try again.'
          : 'Could not create your account. Please try again.')
      );
  }
}

/** Maps API / network errors to a short message suitable for on-screen display. */
export function getAuthUiMessage(error: unknown, context: AuthUiContext): string {
  if (error instanceof AuthRequestError) {
    const fromServer = friendlyFromServerMessage(error.message, context);
    if (fromServer) {
      return fromServer;
    }
    return byStatus(error.status, error.message, context);
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (includesAny(msg, ['Network request failed', 'Failed to fetch', 'network error'])) {
      return 'Could not reach the server. Check Wi‑Fi or mobile data, and that BASE_API_URL points to your machine.';
    }
    const fromServer = friendlyFromServerMessage(msg, context);
    if (fromServer) {
      return fromServer;
    }
    if (msg.length > 0 && msg.length < 180 && !msg.startsWith('{')) {
      return msg;
    }
  }

  return context === 'signIn'
    ? 'Could not sign in. Please try again.'
    : 'Could not create your account. Please try again.';
}
