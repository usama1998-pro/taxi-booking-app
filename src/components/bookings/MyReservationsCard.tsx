import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  bookingChildSeatsSummary,
  bookingFlightLine,
  bookingFromDisplay,
  bookingPassengerLabel,
  bookingSourceIcon,
  bookingToDisplay,
} from '../../lib/bookingFormat';
import type { Booking } from '../../types/booking';
import { spacing, typography } from '../../theme';

const brandBlue = '#1E88E5';
const actionGrey = '#9E9E9E';
const actionRed = '#E53935';
const actionGreen = '#43A047';
const timeBoxGrey = '#E0E0E0';

type Props = {
  booking: Booking;
  driverListLabel: string;
  onPressDriverListLabel: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** When false, the complete (checkmark) action is hidden (e.g. Upcoming tab). */
  showCompleteButton: boolean;
  onComplete: () => void;
};

function formatListTime(iso: string): string {
  try {
    const value = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
    return value.replace(/\s?(am|pm)$/i, (_, m: string) => ` ${m.toUpperCase()}`);
  } catch {
    return '';
  }
}

export function MyReservationsCard({
  booking,
  driverListLabel,
  onPressDriverListLabel,
  onOpenDetail,
  onEdit,
  onDelete,
  showCompleteButton,
  onComplete,
}: Props) {
  const passenger = bookingPassengerLabel(booking);
  const sourceIcon = bookingSourceIcon(booking);
  const flight = bookingFlightLine(booking);
  const childSeats = bookingChildSeatsSummary(booking);
  const statusNorm = (booking.status ?? '').trim().toLowerCase();
  const isClosed = statusNorm === 'completed' || statusNorm === 'cancelled' || statusNorm === 'canceled';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View booking details"
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.cardMainPressable, pressed && styles.cardMainPressed]}
      >
        <View style={styles.cardMainRow}>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{formatListTime(booking.scheduledTime)}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {passenger}
              </Text>
              <Ionicons name={sourceIcon} size={22} color="#424242" />
            </View>
            <Text style={styles.routeLine} numberOfLines={3}>
              <Text style={styles.routePrefix}>From : </Text>
              <Text>{bookingFromDisplay(booking)}</Text>
            </Text>
            <Text style={styles.routeLine} numberOfLines={2}>
              <Text style={styles.routePrefix}>To : </Text>
              <Text>{bookingToDisplay(booking)}</Text>
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaCluster}>
                <Ionicons name="person-outline" size={18} color="#424242" />
                <Text style={styles.metaText}>{booking.passengerCount}</Text>
              </View>
              {flight ? (
                <View style={styles.flightCluster}>
                  <Ionicons name="airplane-outline" size={18} color="#424242" />
                  <View style={styles.flightTextCol}>
                    <Text style={styles.flightNo}>{flight.flight}</Text>
                    {flight.airline ? <Text style={styles.airline}>{flight.airline}</Text> : null}
                  </View>
                </View>
              ) : null}
            </View>
            {childSeats ? (
              <Text style={styles.childSeats} numberOfLines={2}>
                {childSeats}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set driver name on list"
          onPress={onPressDriverListLabel}
          style={({ pressed }) => [styles.btnBlue, pressed && styles.pressed]}
        >
          <Text style={styles.btnBlueText} numberOfLines={1}>
            {driverListLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit booking"
          onPress={onEdit}
          style={({ pressed }) => [styles.btnGrey, pressed && styles.pressed]}
        >
          <Ionicons name="pencil" size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete booking"
          onPress={onDelete}
          style={({ pressed }) => [styles.btnRed, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        </Pressable>
        {showCompleteButton && !isClosed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Complete reservation"
            onPress={onComplete}
            style={({ pressed }) => [styles.btnGreen, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardMainPressable: {
    borderRadius: 2,
    marginHorizontal: -2,
    marginTop: -2,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  cardMainPressed: {
    opacity: 0.92,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeBox: {
    backgroundColor: timeBoxGrey,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  timeText: {
    ...typography.subtitle,
    fontWeight: '700',
    color: '#424242',
    fontVariant: ['tabular-nums'],
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.subtitle,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  routeLine: {
    ...typography.body,
    color: '#424242',
    marginBottom: 2,
  },
  routePrefix: {
    fontWeight: '600',
    color: '#212121',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.body,
    fontWeight: '600',
    color: '#212121',
  },
  flightCluster: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  flightTextCol: {
    justifyContent: 'flex-start',
  },
  flightNo: {
    ...typography.body,
    fontWeight: '700',
    color: '#212121',
  },
  airline: {
    ...typography.caption,
    color: '#616161',
    marginTop: 1,
  },
  childSeats: {
    ...typography.caption,
    color: '#616161',
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  btnBlue: {
    backgroundColor: brandBlue,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBlueText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  btnGrey: {
    backgroundColor: actionGrey,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRed: {
    backgroundColor: actionRed,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: {
    backgroundColor: actionGreen,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
