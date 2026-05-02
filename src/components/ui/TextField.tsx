import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type TextFieldProps = {
  label: string;
  error?: string;
} & TextInputProps;

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.primaryMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    color: colors.primary,
  },
  inputError: { borderColor: colors.danger },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
