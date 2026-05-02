import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';

const AVATAR = 160;
const RING = 3;

export function ProfileScreen() {
  const { user } = useAuth();
  const name = user?.name ?? 'Driver';
  const initial = name.trim().slice(0, 1).toUpperCase() || '?';
  const photoUri = user?.photoUrl?.trim() || null;

  return (
    <Screen style={styles.pad}>
      <View style={styles.hero} accessibilityRole="summary">
        <View style={styles.avatarRing} accessibilityLabel="Profile photo">
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{name}</Text>
      </View>

      <Text style={styles.title}>Driver profile</Text>
      <Text style={styles.hint}>Vehicle and documents can be added here later.</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  avatarRing: {
    width: AVATAR + RING * 2,
    height: AVATAR + RING * 2,
    borderRadius: (AVATAR + RING * 2) / 2,
    borderWidth: RING,
    borderColor: colors.accent,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarPlaceholder: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  avatarLetter: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.accent,
  },
  displayName: {
    ...typography.subtitle,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  title: { ...typography.title, marginBottom: spacing.sm },
  hint: {
    ...typography.body,
    color: colors.primaryMuted,
    marginBottom: spacing.xl,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  label: { ...typography.caption, color: colors.primaryMuted, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.primary },
});
