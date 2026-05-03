import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  bookingChildSeatsSummary,
  bookingDropoffLabel,
  bookingPassengerLabel,
  bookingPickupLabel,
  formatMoney,
} from '../../lib/bookingFormat';
import type { Booking } from '../../types/booking';
import { colors, spacing, typography } from '../../theme';
import { formatDateShort } from '../../utils/formatDate';

type BookingListRowProps = {
  booking: Booking;
  onPress: () => void;
  /** Tap passenger line to show full-screen pickup sign (does not open booking detail). */
  onPassengerNamePress?: (customerName: string) => void;
};

export function BookingListRow({ booking, onPress, onPassengerNamePress }: BookingListRowProps) {
  const passengerLabel = bookingPassengerLabel(booking);
  const childSeats = bookingChildSeatsSummary(booking);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        {onPassengerNamePress ? (
          <View style={styles.passengerRow}>
            <Text style={[styles.passenger, styles.passengerFlex]} numberOfLines={1}>
              {passengerLabel}
            </Text>
            <Pressable
              onPress={() => onPassengerNamePress(passengerLabel)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Show pickup sign with passenger name"
              style={({ pressed }) => [styles.eyeBtn, pressed && styles.eyeBtnPressed]}
            >
              <Ionicons name="eye-outline" size={22} color={colors.accent} />
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.passenger, styles.passengerFlex]} numberOfLines={1}>
            {passengerLabel}
          </Text>
        )}
        <Text style={styles.price}>{formatMoney(booking.price)}</Text>
      </View>
      <Text style={styles.time}>{formatDateShort(booking.scheduledTime)}</Text>
      <Text style={styles.route} numberOfLines={2}>
        {bookingPickupLabel(booking)} → {bookingDropoffLabel(booking)}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.status}>{booking.status}</Text>
        <View style={styles.footerRight}>
          <Text style={styles.meta} numberOfLines={2}>
            {booking.passengerCount} pax · {booking.luggageCount} bags
          </Text>
          {childSeats ? (
            <Text style={styles.childSeatsLine} numberOfLines={4}>
              {childSeats}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.92 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  passengerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  eyeBtn: { padding: spacing.xs },
  eyeBtnPressed: { opacity: 0.75 },
  passengerFlex: { flex: 1 },
  passenger: { ...typography.subtitle, color: colors.primary },
  price: { ...typography.subtitle, color: colors.accent },
  time: { ...typography.caption, color: colors.primaryMuted, marginBottom: spacing.xs },
  route: { ...typography.body, color: colors.primaryMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerRight: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  status: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'capitalize',
    flexShrink: 0,
  },
  meta: {
    ...typography.caption,
    color: colors.primaryMuted,
    textAlign: 'right',
    maxWidth: '100%',
  },
  childSeatsLine: {
    ...typography.caption,
    color: colors.primaryMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
    maxWidth: '100%',
  },
});
