import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { getAuthUiMessage } from '../../lib/authErrors';
import { logger } from '../../lib/logger';
import { spacing, typography } from '../../theme';

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 3;

/** Dark PIN-style screen (charcoal bg, white boxes) — matches product reference. */
const screen = {
  bg: '#2C2C2C',
  label: '#B8B8B8',
  inputBg: '#FFFFFF',
  inputText: '#111111',
} as const;

export function VerificationScreen() {
  const { verifyCode } = useAuth();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const inFlightRef = useRef(false);
  /** Avoid duplicate verify for the same 4-digit string (e.g. Strict Mode / re-renders). */
  const pendingCodeRef = useRef<string | null>(null);

  const code = digits.join('');
  const lockedOut = attemptsLeft < 1;

  const focusInput = (index: number) => {
    if (index < 0 || index >= CODE_LENGTH) {
      return;
    }
    inputsRef.current[index]?.focus();
  };

  const onChangeDigit = (index: number, rawValue: string) => {
    if (lockedOut || isSubmitting) {
      return;
    }
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

    const nextIndex = Math.min(index + cleaned.length, CODE_LENGTH - 1);
    focusInput(nextIndex);
  };

  const onKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') {
      return;
    }
    if (digits[index]) {
      return;
    }
    focusInput(index - 1);
  };

  useEffect(() => {
    if (code.length !== CODE_LENGTH || lockedOut) {
      return;
    }
    if (inFlightRef.current || pendingCodeRef.current === code) {
      return;
    }

    pendingCodeRef.current = code;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setFormError('');

    let cancelled = false;
    (async () => {
      try {
        await verifyCode(code);
      } catch (e) {
        if (cancelled) {
          return;
        }
        logger.warn('VerificationScreen: verify failed', e);
        setFormError(getAuthUiMessage(e, 'verification'));
        setAttemptsLeft((n) => Math.max(0, n - 1));
        pendingCodeRef.current = null;
        setDigits(Array(CODE_LENGTH).fill(''));
        setTimeout(() => focusInput(0), 0);
      } finally {
        if (!cancelled) {
          setIsSubmitting(false);
          inFlightRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, lockedOut, verifyCode]);

  const editable = !lockedOut && !isSubmitting;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.title}>Please Enter Code</Text>

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
              selectionColor={screen.inputText}
              accessible
              accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
            />
          ))}
        </View>

        <Text style={styles.attempts} accessibilityLiveRegion="polite">
          Attempts Left: {attemptsLeft}
        </Text>

        {lockedOut ? (
          <Text style={styles.lockout}>
            No attempts left. Contact your administrator to reset your verification code.
          </Text>
        ) : null}

        {formError && !lockedOut ? (
          <Text style={styles.formError}>{formError}</Text>
        ) : null}

        {isSubmitting ? (
          <View
            style={styles.loaderWrap}
            accessibilityRole="progressbar"
            accessibilityLabel="Verifying your code"
          >
            <ActivityIndicator size="small" color={screen.label} />
            <Text style={styles.loaderText}>Verifying your code…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const BOX = 60;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: screen.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  title: {
    ...typography.body,
    color: screen.label,
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
    backgroundColor: screen.inputBg,
    color: screen.inputText,
    fontSize: 24,
    fontWeight: '600',
    overflow: 'hidden',
  },
  attempts: {
    ...typography.body,
    color: screen.label,
    textAlign: 'center',
  },
  lockout: {
    ...typography.caption,
    color: screen.label,
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
    color: screen.label,
    textAlign: 'center',
  },
});
