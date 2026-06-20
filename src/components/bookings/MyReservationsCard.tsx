import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  bookingChildSeatsSummary,
  bookingFlightLine,
  bookingFromDisplayForList,
  bookingPassengerLabel,
  bookingSourceAccessibilityLabel,
  bookingSourceIcon,
  bookingSourceIconColor,
  bookingToDisplayForList,
} from '../../lib/bookingFormat';
import type { Booking } from '../../types/booking';
import { BOOKING_TIME_ZONE } from '../../constants/timeZone';
import { spacing } from '../../theme';

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
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: BOOKING_TIME_ZONE,
    }).format(new Date(iso));
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
  const sourceIconColor = bookingSourceIconColor(booking);
  const sourceLabel = bookingSourceAccessibilityLabel(booking);
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
              <Ionicons
                name={sourceIcon}
                size={24}
                color={sourceIconColor}
                accessibilityLabel={sourceLabel}
              />
            </View>
            <View style={styles.routeLine}>
              <Text style={styles.routeLineText} numberOfLines={2} ellipsizeMode="tail">
                <Text style={styles.routePrefix}>From : </Text>
                <Text style={styles.routeValueInline}>{bookingFromDisplayForList(booking)}</Text>
              </Text>
            </View>
            <View style={styles.routeLine}>
              <Text style={styles.routeLineText} numberOfLines={2} ellipsizeMode="tail">
                <Text style={styles.routePrefix}>To : </Text>
                <Text style={styles.routeValueInline}>{bookingToDisplayForList(booking)}</Text>
              </Text>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaCluster}>
                <Ionicons name="person" size={20} color="#424242" />
                <Text style={styles.metaText}>{booking.passengerCount}</Text>
              </View>
              {flight ? (
                <View style={styles.flightCluster}>
                  <Ionicons name="airplane" size={20} color="#424242" />
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
          <Ionicons name="pencil" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete booking"
          onPress={onDelete}
          style={({ pressed }) => [styles.btnRed, pressed && styles.pressed]}
        >
          <Ionicons name="trash" size={22} color="#FFFFFF" />
        </Pressable>
        {showCompleteButton && !isClosed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Complete reservation"
            onPress={onComplete}
            style={({ pressed }) => [styles.btnGreen, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
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
    marginBottom: spacing.sm,
    padding: spacing.sm,
    overflow: 'hidden',
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  timeText: {
    fontSize: 20,
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
    gap: spacing.xs,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  routeLine: {
    marginBottom: 2,
    width: '100%',
  },
  routeLineText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#424242',
  },
  routePrefix: {
    fontWeight: '600',
    color: '#212121',
  },
  routeValueInline: {
    fontWeight: '400',
    color: '#424242',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 17,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#212121',
  },
  airline: {
    fontSize: 15,
    color: '#616161',
    marginTop: 1,
  },
  childSeats: {
    fontSize: 15,
    color: '#616161',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  btnBlue: {
    backgroundColor: brandBlue,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBlueText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  btnGrey: {
    backgroundColor: actionGrey,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRed: {
    backgroundColor: actionRed,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: {
    backgroundColor: actionGreen,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
