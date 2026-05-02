import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner and blocks presses (e.g. while an API request runs). */
  loading?: boolean;
  /** Merged onto the outer pressable (e.g. `alignSelf: 'stretch'` in a row layout). */
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, disabled, loading, style }: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  label: {
    ...typography.subtitle,
    color: colors.background,
  },
});
