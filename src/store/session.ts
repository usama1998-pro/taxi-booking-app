/**
 * Placeholder for auth/session state (Context, Zustand, Jotai, etc.).
 * Replace with your real store when you wire login.
 */
export type SessionUser = {
  id: string;
  displayName: string;
};

export type SessionState = {
  user: SessionUser | null;
  token: string | null;
};
