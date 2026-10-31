import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { getAppUiMessage } from '../../lib/apiErrors';
import { pricingApi } from '../../services/pricing/pricingApi';
import { spacing, typography } from '../../theme';

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 3;

/** Same dark PIN look as driver verification / Prices. */
const pinScreen = {
  bg: '#2C2C2C',
  label: '#B8B8B8',
  inputBg: '#FFFFFF',
  inputText: '#111111',
} as const;

const BOX = 60;

type Props = {
  children: ReactNode;
  /** Called after a successful passcode unlock (e.g. load gated data). */
  onUnlocked?: () => void;
};

/**
 * Gates pricing-related screens (Prices, Calculate) behind the driver passcode.
 * Re-prompts on every visit, matching the Prices screen behavior.
 */
export function PricingPasscodeGate({ children, onUnlocked }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const inFlightRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);
  /** Ignore stale unlock-status responses after leave/re-enter. */
  const statusGenRef = useRef(0);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  const code = digits.join('');
  const inputLocked = lockedSeconds > 0;
  const lockedOut = inputLocked || attemptsLeft < 1;
  const editable = !lockedOut && !unlocking;
  const lockMinutes = Math.max(1, Math.ceil(lockedSeconds / 60));

  const focusInput = (index: number) => {
    if (index < 0 || index >= CODE_LENGTH) return;
    inputsRef.current[index]?.focus();
  };

  const resetDigits = () => {
    pendingCodeRef.current = null;
    setDigits(Array(CODE_LENGTH).fill(''));
    setTimeout(() => focusInput(0), 0);
  };

  const applyUnlockStatus = useCallback((status: Awaited<ReturnType<typeof pricingApi.unlockStatus>>) => {
    const remainingSec = Number(status.remainingSeconds) || 0;
    const attempts = Number(status.attemptsRemaining);
    setLockedSeconds(status.locked ? remainingSec : 0);
    if (status.locked) {
      setAttemptsLeft(0);
    } else {
      setAttemptsLeft(Number.isFinite(attempts) ? attempts : MAX_ATTEMPTS);
    }
  }, []);

  const refreshLockStatus = useCallback(
    async (options?: { fresh?: boolean }) => {
      if (!accessToken) return;
      const gen = statusGenRef.current;
      try {
        const status = await pricingApi.unlockStatus(accessToken, options);
        if (gen !== statusGenRef.current) return;
        applyUnlockStatus(status);
      } catch {
        /* ignore */
      }
    },
    [accessToken, applyUnlockStatus],
  );

  useFocusEffect(
    useCallback(() => {
      statusGenRef.current += 1;
      setUnlocked(false);
      setUnlockError('');
      setAttemptsLeft(MAX_ATTEMPTS);
      setLockedSeconds(0);
      setDigits(Array(CODE_LENGTH).fill(''));
      pendingCodeRef.current = null;
      inFlightRef.current = false;
      void refreshLockStatus({ fresh: true });
      setTimeout(() => focusInput(0), 100);
      return () => {
        statusGenRef.current += 1;
      };
    }, [refreshLockStatus]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerShown: unlocked,
    });
  }, [navigation, unlocked]);

  useEffect(() => {
    if (lockedSeconds <= 0) return;
    const id = setInterval(() => {
      setLockedSeconds((s) => {
        const next = Math.max(0, s - 1);
        if (next === 0) {
          setAttemptsLeft(MAX_ATTEMPTS);
          void refreshLockStatus();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedSeconds > 0, refreshLockStatus]);

  const submitCode = useCallback(
    async (fullCode: string) => {
      if (!accessToken || inFlightRef.current || lockedOut) return;
      inFlightRef.current = true;
      setUnlocking(true);
      setUnlockError('');
      try {
        await pricingApi.unlock(accessToken, fullCode);
        setUnlocked(true);
        setAttemptsLeft(MAX_ATTEMPTS);
        setLockedSeconds(0);
        setDigits(Array(CODE_LENGTH).fill(''));
        pendingCodeRef.current = null;
        onUnlockedRef.current?.();
      } catch (err) {
        setUnlockError(getAppUiMessage(err));
        resetDigits();
        const gen = statusGenRef.current;
        try {
          const status = await pricingApi.unlockStatus(accessToken);
          if (gen === statusGenRef.current) {
            applyUnlockStatus(status);
          }
        } catch {
          if (gen === statusGenRef.current) {
            setAttemptsLeft((prev) => Math.max(0, prev - 1));
          }
        }
      } finally {
        setUnlocking(false);
        inFlightRef.current = false;
      }
    },
    [accessToken, applyUnlockStatus, lockedOut],
  );

  useEffect(() => {
    if (unlocked || code.length !== CODE_LENGTH || lockedOut) return;
    if (inFlightRef.current || pendingCodeRef.current === code) return;
    pendingCodeRef.current = code;
    void submitCode(code);
  }, [code, lockedOut, submitCode, unlocked]);

  const onChangeDigit = (index: number, rawValue: string) => {
    if (lockedOut || unlocking) return;
    const cleaned = rawValue.replace(/\D/g, '');
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < cleaned.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = cleaned[i];
      }
      return next;
    });
    focusInput(Math.min(index + cleaned.length, CODE_LENGTH - 1));
  };

  const onKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') return;
    if (digits[index]) return;
    focusInput(index - 1);
  };

  if (!unlocked) {
    return (
      <View style={[styles.pinRoot, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.pinTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.pinBackBtn, pressed && styles.headerPressed]}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            <Text style={styles.pinBackLabel}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.pinContent}>
          <Text style={styles.pinTitle}>Please Enter Code</Text>

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputsRef.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) => onChangeDigit(index, value)}
                onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                editable={editable}
                style={styles.codeInput}
                textAlign="center"
                returnKeyType="done"
                selectionColor={pinScreen.inputText}
                accessible
                accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
              />
            ))}
          </View>

          <Text style={styles.attempts} accessibilityLiveRegion="polite">
            Attempts Left: {inputLocked ? 0 : attemptsLeft}
          </Text>

          {inputLocked ? (
            <Text style={styles.lockout}>
              Too many failed attempts. Try again in about {lockMinutes} minute
              {lockMinutes === 1 ? '' : 's'}.
            </Text>
          ) : null}

          {unlockError && !inputLocked ? (
            <Text style={styles.formError}>{unlockError}</Text>
          ) : null}

          {unlocking ? (
            <View
              style={styles.loaderWrap}
              accessibilityRole="progressbar"
              accessibilityLabel="Verifying your code"
            >
              <ActivityIndicator size="small" color={pinScreen.label} />
              <Text style={styles.loaderText}>Verifying your code…</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  pinRoot: {
    flex: 1,
    backgroundColor: pinScreen.bg,
  },
  pinTopBar: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    zIndex: 2,
  },
  pinBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    minHeight: 44,
  },
  pinBackLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerPressed: { opacity: 0.7 },
  pinContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  pinTitle: {
    ...typography.body,
    color: pinScreen.label,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: BOX,
    height: BOX,
    borderRadius: 4,
    backgroundColor: pinScreen.inputBg,
    color: pinScreen.inputText,
    fontSize: 24,
    fontWeight: '600',
    overflow: 'hidden',
  },
  attempts: {
    ...typography.body,
    color: pinScreen.label,
    textAlign: 'center',
  },
  lockout: {
    ...typography.caption,
    color: pinScreen.label,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  formError: {
    ...typography.caption,
    color: '#F87171',
    marginTop: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  loaderWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  loaderText: {
    ...typography.caption,
    color: pinScreen.label,
    textAlign: 'center',
  },
});
