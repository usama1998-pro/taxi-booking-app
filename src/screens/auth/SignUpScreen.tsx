import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenLayout, PrimaryButton, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { getAuthUiMessage } from '../../lib/authErrors';
import { logger } from '../../lib/logger';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

const MIN_PASSWORD_LEN = 8;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    setFormError('');
    if (password !== confirm) {
      setFormError('Those passwords do not match. Re-enter them and try again.');
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setFormError(
        `Your password must be at least ${MIN_PASSWORD_LEN} characters long (required by the server).`,
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp({
        name,
        email,
        phone,
        password,
      });
    } catch (e) {
      logger.warn('SignUpScreen: submit failed', e);
      setFormError(e instanceof Error ? e.message : getAuthUiMessage(e, 'signUp'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout>
      <Text style={styles.lead}>
        Register as a driver. After sign up you will land on your home dashboard.
      </Text>
      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        editable={!isSubmitting}
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!isSubmitting}
      />
      <TextField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        editable={!isSubmitting}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        editable={!isSubmitting}
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        editable={!isSubmitting}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PrimaryButton label="Create account" onPress={onSubmit} loading={isSubmitting} />
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={() => navigation.navigate('SignIn')}
        style={[styles.linkWrap, isSubmitting && styles.linkDisabled]}
      >
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  lead: {
    ...typography.body,
    color: colors.primaryMuted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  formError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  linkWrap: { marginTop: spacing.lg, alignSelf: 'center' },
  linkDisabled: { opacity: 0.45 },
  link: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'center',
  },
});
