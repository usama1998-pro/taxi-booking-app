import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenLayout, PrimaryButton, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { getAuthUiMessage } from '../../lib/authErrors';
import { logger } from '../../lib/logger';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    setFormError('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      logger.warn('SignInScreen: submit failed', e);
      setFormError(e instanceof Error ? e.message : getAuthUiMessage(e, 'signIn'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout>
      <Text style={styles.lead}>Sign in to accept trips and manage your driver account.</Text>
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
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        editable={!isSubmitting}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PrimaryButton label="Sign in" onPress={onSubmit} loading={isSubmitting} />
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={() => navigation.navigate('SignUp')}
        style={[styles.linkWrap, isSubmitting && styles.linkDisabled]}
      >
        <Text style={styles.link}>New driver? Create an account</Text>
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
