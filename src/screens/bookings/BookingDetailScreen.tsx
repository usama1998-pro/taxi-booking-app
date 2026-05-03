import * as Clipboard from 'expo-clipboard';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import {
  bookingChildSeatsSummary,
  bookingDropoffLabel,
  bookingPassengerLabel,
  bookingPickupLabel,
  formatMoney,
} from '../../lib/bookingFormat';
import { bookingToInvoicePrefill } from '../../lib/bookingInvoicePrefill';
import { logger } from '../../lib/logger';
import type {
  BookingDetailHostStackParamList,
  DriverDrawerParamList,
} from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import type { Booking } from '../../types/booking';
import { colors, spacing, typography } from '../../theme';
import { formatDateShort } from '../../utils/formatDate';

type BookingDetailParams = { BookingDetail: { uuid: string } };

const COPY_TICK_MS = 1600;

function notifyCopiedAndroid() {
  if (Platform.OS === 'android') {
    ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
  }
}

async function copyStringToClipboard(value: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(value);
  } catch {
    return false;
  }
}

/** All fields that have individual copy actions on this screen. */
function scheduledLocalYmd(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCopyableSummary(b: Booking): string {
  const lines: string[] = [];
  const tripYmd = scheduledLocalYmd(b.scheduledTime);
  if (tripYmd) {
    lines.push(`Trip date: ${tripYmd}`);
  }
  if (b.customerName?.trim()) {
    lines.push(`Name: ${b.customerName.trim()}`);
  }
  if (b.customerEmail?.trim()) {
    lines.push(`Email: ${b.customerEmail.trim()}`);
  }
  if (b.customerPhone?.trim()) {
    lines.push(`Phone: ${b.customerPhone.trim()}`);
  }
  if (b.flightNumber?.trim()) {
    lines.push(`Flight: ${b.flightNumber.trim()}`);
  }
  if (b.bookingReference?.trim()) {
    lines.push(`Booking reference: ${b.bookingReference.trim()}`);
  }
  const seats = bookingChildSeatsSummary(b);
  if (seats) {
    lines.push(`Child seats: ${seats}`);
  }
  return lines.join('\n');
}

export function BookingDetailScreen() {
  const route = useRoute<RouteProp<BookingDetailParams, 'BookingDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<BookingDetailHostStackParamList, 'BookingDetail'>>();
  const { uuid } = route.params;
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const b = await bookingsApi.getByUuid(accessToken, uuid);
      setBooking(b);
    } catch (e) {
      logger.warn('BookingDetailScreen: load failed', e);
      setError(e instanceof Error ? e.message : 'Could not load booking.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, uuid]);

  const submitComplete = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setCompleting(true);
    try {
      const updated = await bookingsApi.update(accessToken, uuid, { status: 'completed' });
      setBooking(updated);
      Alert.alert('Trip complete', 'This booking is now under Past. Latest completed trips stay at the top there.');
    } catch (e) {
      logger.warn('BookingDetailScreen: mark complete failed', e);
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCompleting(false);
    }
  }, [accessToken, uuid]);

  const onMarkComplete = useCallback(() => {
    Alert.alert(
      'Mark trip complete?',
      'It moves to Past trips. The list shows the most recently completed ride first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark complete', onPress: () => void submitComplete() },
      ],
    );
  }, [submitComplete]);

  const submitStartRide = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setStarting(true);
    try {
      const updated = await bookingsApi.update(accessToken, uuid, { status: 'in_progress' });
      setBooking(updated);
      Alert.alert(
        'Ride started',
        'This booking is now under Current. Mark it complete when the trip ends.',
      );
    } catch (e) {
      logger.warn('BookingDetailScreen: start ride failed', e);
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setStarting(false);
    }
  }, [accessToken, uuid]);

  const onStartRide = useCallback(() => {
    Alert.alert('Start ride?', 'This booking moves to your Current list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: () => void submitStartRide() },
    ]);
  }, [submitStartRide]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen style={styles.pad}>
        <Text style={styles.error}>{error ?? 'Booking not found.'}</Text>
      </Screen>
    );
  }

  const b = booking;
  const childSeatsLine = bookingChildSeatsSummary(b);

  const customerNameForSign =
    b.customerName?.trim() || b.user?.fullName?.trim() || bookingPassengerLabel(b);

  const openPickupSign = () => {
    navigation.navigate('PickupSign', { customerName: customerNameForSign });
  };

  const goToNewInvoice = () => {
    const prefill = bookingToInvoicePrefill(b);
    const drawerNav = navigation.getParent<DrawerNavigationProp<DriverDrawerParamList>>();
    drawerNav?.navigate('Invoices', {
      screen: 'InvoiceCreate',
      params: { prefill },
    });
  };

  const terminalStatuses = new Set(['completed', 'cancelled', 'canceled']);
  const statusNorm = (b.status ?? '').trim().toLowerCase();
  const isTerminal = terminalStatuses.has(statusNorm);
  const canStartRide = statusNorm.length > 0 && !isTerminal && statusNorm !== 'in_progress';
  const canMarkComplete = statusNorm === 'in_progress';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{bookingPassengerLabel(b)}</Text>
        <Text style={styles.sub}>{formatDateShort(b.scheduledTime)}</Text>

        <View style={styles.invoiceFromBooking}>
          <PrimaryButton
            label="New invoice from this booking"
            onPress={goToNewInvoice}
            style={styles.invoicePrimaryBtn}
          />
        </View>

        <View style={styles.copyAllTop}>
          <CopyAllDetailsButton booking={b} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip</Text>
          <Row label="Status" value={b.status} />
          <Row label="Price" value={formatMoney(b.price)} />
          <Row label="Passengers" value={String(b.passengerCount)} />
          <Row label="Luggage" value={String(b.luggageCount)} />
          {childSeatsLine ? <Row label="Child seats" value={childSeatsLine} /> : null}
          {b.flightNumber ? <Row label="Flight" value={b.flightNumber} copyable /> : null}
          {b.returnTime ? (
            <Row label="Return" value={formatDateShort(b.returnTime)} />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup</Text>
          <Text style={styles.block}>{bookingPickupLabel(b)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Drop-off</Text>
          <Text style={styles.block}>{bookingDropoffLabel(b)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          {b.customerName?.trim() || b.user?.fullName?.trim() ? (
            <Row
              label="Name"
              value={b.customerName?.trim() || b.user?.fullName?.trim() || '—'}
              copyable
              pickupSignPress={openPickupSign}
            />
          ) : (
            <Row
              label="Passenger"
              value={bookingPassengerLabel(b)}
              copyable
              pickupSignPress={openPickupSign}
            />
          )}
          {b.customerEmail ? <Row label="Email" value={b.customerEmail} copyable /> : null}
          {b.customerPhone ? <Row label="Phone" value={b.customerPhone} copyable /> : null}
        </View>

        {b.note ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Note</Text>
            <Text style={styles.block}>{b.note}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record</Text>
          <Row label="Booking reference" value={b.bookingReference} copyable />
          <Row label="Created" value={formatDateShort(b.createdAt)} />
          {b.completedAt ? <Row label="Completed" value={formatDateShort(b.completedAt)} /> : null}
        </View>

        {canStartRide ? (
          <View style={styles.completeSection}>
            <PrimaryButton
              label="Start ride"
              onPress={onStartRide}
              loading={starting}
              style={styles.completePrimaryBtn}
            />
            <Text style={styles.completeHint}>
              Moves this booking to Current. When the trip ends, mark it complete to send it to Past.
            </Text>
          </View>
        ) : null}
        {canMarkComplete ? (
          <View style={styles.completeSection}>
            <PrimaryButton
              label="Mark trip complete"
              onPress={onMarkComplete}
              loading={completing}
              style={styles.completePrimaryBtn}
            />
            <Text style={styles.completeHint}>
              Moves this ride to Past. The most recently completed trip appears first there.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function CopyAllDetailsButton({ booking }: { booking: Booking }) {
  const [showTick, setShowTick] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flashTick = () => {
    setShowTick(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setShowTick(false), COPY_TICK_MS);
  };

  const onCopyAll = async () => {
    const text = buildCopyableSummary(booking);
    const ok = await copyStringToClipboard(text);
    if (ok) {
      flashTick();
      notifyCopiedAndroid();
    } else {
      Alert.alert('Copy failed', 'Could not copy to the clipboard.');
    }
  };

  return (
    <Pressable
      onPress={() => void onCopyAll()}
      style={({ pressed }) => [styles.copyAllBtn, pressed && styles.copyAllBtnPressed]}
      accessibilityRole="button"
      accessibilityLabel="Copy all customer, flight, and booking reference"
    >
      <Text style={styles.copyAllLabel}>Copy all details</Text>
      <Ionicons
        name={showTick ? 'checkmark-circle' : 'copy-outline'}
        size={22}
        color={showTick ? colors.success : colors.accent}
      />
    </Pressable>
  );
}

function Row({
  label,
  value,
  copyable = false,
  onValuePress,
  pickupSignPress,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  /** Tap the value (e.g. customer name) to open full-screen pickup sign. */
  onValuePress?: () => void;
  /** Show eye control to open pickup sign (e.g. next to customer name). */
  pickupSignPress?: () => void;
}) {
  const [showTick, setShowTick] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flashTick = () => {
    setShowTick(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setShowTick(false), COPY_TICK_MS);
  };

  const onCopy = async () => {
    const ok = await copyStringToClipboard(value);
    if (ok) {
      flashTick();
      notifyCopiedAndroid();
    } else {
      Alert.alert('Copy failed', 'Could not copy to the clipboard.');
    }
  };

  const valueText = (
    <Text
      style={[styles.rowValue, onValuePress && styles.rowValueTappable]}
      selectable={copyable && !onValuePress}
      onLongPress={copyable ? () => void onCopy() : undefined}
    >
      {value}
    </Text>
  );

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <View style={styles.rowValueTextBlock}>
          {onValuePress ? (
            <Pressable
              onPress={onValuePress}
              style={({ pressed }) => [styles.valuePressable, pressed && styles.valuePressablePressed]}
              accessibilityRole="button"
              accessibilityLabel={`Show pickup sign for ${label}`}
            >
              {valueText}
            </Pressable>
          ) : (
            valueText
          )}
        </View>
        {pickupSignPress ? (
          <Pressable
            onPress={pickupSignPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Show pickup sign with customer name"
            style={styles.copyBtn}
          >
            <Ionicons name="eye-outline" size={24} color={colors.accent} />
          </Pressable>
        ) : null}
        {copyable ? (
          <Pressable
            onPress={() => void onCopy()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
            style={styles.copyBtn}
          >
            <Ionicons
              name={showTick ? 'checkmark-circle' : 'copy-outline'}
              size={22}
              color={showTick ? colors.success : colors.accent}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.title, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.primaryMuted, marginBottom: spacing.sm },
  invoiceFromBooking: { marginBottom: spacing.md, alignSelf: 'stretch' },
  invoicePrimaryBtn: { alignSelf: 'stretch' },
  completeSection: { marginTop: spacing.lg, marginBottom: spacing.md, alignSelf: 'stretch' },
  completePrimaryBtn: { alignSelf: 'stretch' },
  completeHint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  copyAllTop: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    color: colors.primary,
  },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  copyAllBtnPressed: { opacity: 0.88 },
  copyAllLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accent,
    flex: 1,
  },
  block: { ...typography.body, color: colors.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.primaryMuted,
    flexShrink: 0,
    paddingTop: 2,
  },
  rowValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minWidth: 0,
  },
  rowValueTextBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  rowValue: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'right',
    alignSelf: 'stretch',
    width: '100%',
  },
  rowValueTappable: { textDecorationLine: 'underline', textDecorationColor: colors.accent },
  valuePressable: { alignSelf: 'stretch', width: '100%' },
  valuePressablePressed: { opacity: 0.75 },
  copyBtn: { padding: spacing.xs },
  error: { ...typography.body, color: colors.danger },
});
