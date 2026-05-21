import { AuthRequestError } from '../services/auth/authApi';

/** Shown for 5xx and gateway errors — avoids exposing internal error text. */
export const SYSTEM_DOWN_MESSAGE =
  'The system is down at the moment. Please try again shortly.';

export class ApiRequestError extends Error {
  override readonly name = 'ApiRequestError';

  constructor(
    message: string,
    public readonly status: number,
    public readonly path?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isNetworkFailureMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('network error') ||
    m.includes('timeout') ||
    m.includes('aborted')
  );
}

export function isInternalServerStatus(status: number): boolean {
  return status >= 500;
}

export async function readResponseErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: unknown };
    if (Array.isArray(j.message)) {
      return j.message.map(String).join('\n');
    }
    if (typeof j.message === 'string') {
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return text.trim() || `Request failed (${res.status})`;
}

/** Pass through short, safe server messages; hide JSON blobs and long technical text. */
export function friendlyFromServerMessage(msg: string): string | null {
  const m = msg.trim();
  if (!m || m.length >= 200 || m.includes('{')) {
    return null;
  }
  if (isNetworkFailureMessage(m)) {
    return null;
  }
  if (/^request failed \(\d+\)$/i.test(m)) {
    return null;
  }
  return m;
}

function byHttpStatus(status: number, serverMsg: string): string {
  if (status === 0 || isNetworkFailureMessage(serverMsg)) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  if (isInternalServerStatus(status)) {
    return SYSTEM_DOWN_MESSAGE;
  }

  const fromServer = friendlyFromServerMessage(serverMsg);

  switch (status) {
    case 400:
      return fromServer ?? 'Something in the request was not valid. Please try again.';
    case 401:
      return fromServer ?? 'Your session has expired. Please sign in again.';
    case 403:
      return fromServer ?? 'You do not have permission to do that.';
    case 404:
      return fromServer ?? 'We could not find what you were looking for.';
    case 409:
      return fromServer ?? 'This action is no longer available.';
    case 422:
      return fromServer ?? 'Some details are not valid. Please review and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return fromServer ?? 'Something went wrong. Please try again.';
  }
}

/** Maps API / network errors to a short message for on-screen display. */
export function getAppUiMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiRequestError || error instanceof AuthRequestError) {
    const status = error.status;
    const serverMsg = error.message;
    if (!isInternalServerStatus(status)) {
      const fromServer = friendlyFromServerMessage(serverMsg);
      if (fromServer) {
        return fromServer;
      }
    }
    return byHttpStatus(status, serverMsg);
  }

  if (error instanceof Error) {
    if (isNetworkFailureMessage(error.message)) {
      return 'Unable to connect. Check your internet connection and try again.';
    }
    const fromServer = friendlyFromServerMessage(error.message);
    if (fromServer) {
      return fromServer;
    }
  }

  return fallback;
}
