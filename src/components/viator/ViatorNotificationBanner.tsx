import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { phoneForDisplay } from '../../lib/phoneFormat';
import type { ViatorNotification } from '../../services/viator/viatorNotificationsApi';
import { colors, spacing, typography } from '../../theme';

type Props = {
  notifications: ViatorNotification[];
  onDismiss: (id: string) => void;
  onDismissAll?: () => void;
};

export function ViatorNotificationBanner({
  notifications,
  onDismiss,
  onDismissAll,
}: Props) {
  if (notifications.length === 0) {
    return null;
  }

  const latest = notifications[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="mail-unread-outline" size={22} color="#1565C0" />
        <View style={styles.body}>
          <Text style={styles.title}>New Viator booking</Text>
          <Text style={styles.ref}>{latest.viatorReference}</Text>
          <Text style={styles.date}>{latest.pickupDateLabel}</Text>
          {latest.leadTraveler ? (
            <Text style={styles.detail}>{latest.leadTraveler}</Text>
          ) : null}
          {latest.pickupLocation ? (
            <Text style={styles.detail}>Pickup: {latest.pickupLocation}</Text>
          ) : null}
          {latest.dropoffLocation || latest.cruiseShipName ? (
            <Text style={styles.detail}>
              Drop-off: {latest.cruiseShipName?.trim() || latest.dropoffLocation}
            </Text>
          ) : null}
          {latest.phone ? (
            <Text style={styles.detail}>{phoneForDisplay(latest.phone)}</Text>
          ) : null}
          {notifications.length > 1 ? (
            <Text style={styles.more}>
              +{notifications.length - 1} more unread
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove notification"
          onPress={() => onDismiss(latest.id)}
          hitSlop={12}
          style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      {notifications.length > 1 && onDismissAll ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onDismissAll()}
          style={({ pressed }) => [styles.dismissAll, pressed && styles.pressed]}
        >
          <Text style={styles.dismissAllText}>Remove all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.caption,
    color: '#0D47A1',
    fontWeight: '700',
  },
  ref: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  more: {
    ...typography.caption,
    color: '#1565C0',
    marginTop: 4,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissAll: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  dismissAllText: {
    ...typography.caption,
    color: '#1565C0',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
