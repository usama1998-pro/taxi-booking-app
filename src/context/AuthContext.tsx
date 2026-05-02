import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clearAppCaches } from '../lib/clearAppCaches';
import { getAuthUiMessage } from '../lib/authErrors';
import { logger } from '../lib/logger';
import { authApi } from '../services/auth/authApi';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '../services/auth/tokenStorage';
import { colors, spacing, typography } from '../theme';

export type DriverUser = {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  isAvailable: boolean;
  isActive: boolean;
};

type AuthContextValue = {
  user: DriverUser | null;
  accessToken: string | null;
  isHydrating: boolean;
  isSigningOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAvailability: (isAvailable: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function establishSession(accessToken: string): Promise<DriverUser> {
  const verified = await authApi.verify(accessToken);
  if (verified.typ !== 'driver') {
    logger.warn('Auth: session principal is not a driver', { typ: verified.typ });
    throw new Error('This app is for drivers only. Sign in with a driver account.');
  }
  const profile = await authApi.fetchMyProfile(accessToken);
  logger.debug('Auth: session established', { driverId: profile.id });
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    photoUrl: profile.photoUrl ?? null,
    ratingAverage: profile.ratingAverage ?? null,
    ratingCount: profile.ratingCount ?? null,
    isAvailable: profile.isAvailable ?? true,
    isActive: profile.isActive ?? true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DriverUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signOutInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getStoredAccessToken();
        if (!token || cancelled) {
          return;
        }
        const nextUser = await establishSession(token);
        if (cancelled) {
          return;
        }
        setAccessToken(token);
        setUser(nextUser);
      } catch (e) {
        logger.warn('Auth: stored session restore failed', e);
        await clearStoredAccessToken();
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error('Please enter your email and password.');
    }
    logger.debug('Auth: sign-in request');
    try {
      const { access_token } = await authApi.signIn({
        email: email.trim().toLowerCase(),
        password,
      });
      const nextUser = await establishSession(access_token);
      await setStoredAccessToken(access_token);
      setAccessToken(access_token);
      setUser(nextUser);
      logger.info('Auth: signed in', { driverId: nextUser.id });
    } catch (e) {
      logger.error('Auth: sign-in error', e);
      throw new Error(getAuthUiMessage(e, 'signIn'));
    }
  }, []);

  const signUp = useCallback(
    async (input: { name: string; email: string; phone: string; password: string }) => {
      const { name, email, phone, password } = input;
      if (!name.trim() || !email.trim() || !phone.trim() || !password) {
        throw new Error('Please fill in every field to continue.');
      }
      logger.debug('Auth: sign-up request');
      try {
        const { access_token } = await authApi.signUp({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        });
        const nextUser = await establishSession(access_token);
        await setStoredAccessToken(access_token);
        setAccessToken(access_token);
        setUser(nextUser);
        logger.info('Auth: signed up and session ready', { driverId: nextUser.id });
      } catch (e) {
        logger.error('Auth: sign-up error', e);
        throw new Error(getAuthUiMessage(e, 'signUp'));
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const token = accessToken ?? (await getStoredAccessToken());
    if (!token) {
      return;
    }
    try {
      const profile = await authApi.fetchMyProfile(token);
      setUser((prev) =>
        prev?.id === profile.id
          ? {
              ...prev,
              name: profile.name,
              email: profile.email,
              photoUrl: profile.photoUrl ?? prev.photoUrl,
              ratingAverage: profile.ratingAverage ?? prev.ratingAverage,
              ratingCount: profile.ratingCount ?? prev.ratingCount,
              isAvailable: profile.isAvailable ?? true,
              isActive: profile.isActive ?? true,
            }
          : prev,
      );
    } catch (e) {
      logger.warn('Auth: profile refresh failed', e);
    }
  }, [accessToken]);

  const updateAvailability = useCallback(
    async (isAvailable: boolean) => {
      const token = accessToken ?? (await getStoredAccessToken());
      if (!token) {
        throw new Error('You are not signed in.');
      }
      await authApi.patchMyAvailability(token, isAvailable);
      setUser((prev) => (prev ? { ...prev, isAvailable } : prev));
    },
    [accessToken],
  );

  const signOut = useCallback(async () => {
    if (signOutInProgress.current) {
      return;
    }
    signOutInProgress.current = true;
    setIsSigningOut(true);
    try {
      const token = accessToken ?? (await getStoredAccessToken());
      if (token) {
        try {
          await authApi.signOut(token);
          logger.debug('Auth: server sign-out ok');
        } catch (e) {
          logger.warn('Auth: server sign-out failed (clearing locally anyway)', e);
        }
      }
      await clearStoredAccessToken();
      await clearAppCaches();
      logger.debug('Auth: local caches cleared after sign-out');
      setAccessToken(null);
      setUser(null);
    } finally {
      signOutInProgress.current = false;
      setIsSigningOut(false);
    }
  }, [accessToken]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isHydrating,
      isSigningOut,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateAvailability,
    }),
    [
      user,
      accessToken,
      isHydrating,
      isSigningOut,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateAvailability,
    ],
  );

  return (
    <>
      <Modal visible={isSigningOut} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.signOutOverlay} accessibilityLabel="Signing out">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.signOutLabel}>Signing out…</Text>
        </View>
      </Modal>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  signOutOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    gap: spacing.md,
  },
  signOutLabel: {
    ...typography.body,
    color: colors.primaryMuted,
  },
});

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
