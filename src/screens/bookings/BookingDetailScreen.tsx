import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { bookingFromDisplay, bookingPassengerLabel, bookingToDisplay } from '../../lib/bookingFormat';
import { logger } from '../../lib/logger';
import type { BookingDetailHostStackParamList } from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import type { Booking } from '../../types/booking';
import { colors, spacing, typography } from '../../theme';

type BookingDetailParams = { BookingDetail: { uuid: string } };

const COPY_TICK_MS = 1600;
const HEADER_BLUE = '#2196F3';
const ICON_BLACK = '#111827';
const FOOTER_MUTED = '#9CA3AF';
const SITE_URL = 'https://www.taxibarcelonas.com';

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

function formatPickupDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPickupTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function formatResNumber(b: Booking): string {
  const ref = b.bookingReference?.trim();
  if (ref) {
    const digits = ref.replace(/\D/g, '');
    if (digits.length > 0) {
      return digits;
    }
    return ref;
  }
  const hex = b.uuid.replace(/-/g, '');
  const slice = hex.slice(-12);
  const n = Number.parseInt(slice, 16);
  if (!Number.isFinite(n)) {
    return b.uuid.slice(0, 8).toUpperCase();
  }
  return String(n % 100000).padStart(5, '0');
}

function formatFooterTimestamp(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${y} ${h}:${min}`;
}

function smsUrl(phone: string): string {
  const core = phone.replace(/[^\d+]/g, '');
  return `sms:${core}`;
}

export function BookingDetailScreen() {
  const route = useRoute<RouteProp<BookingDetailParams, 'BookingDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<BookingDetailHostStackParamList, 'BookingDetail'>>();
  const insets = useSafeAreaInsets();
  const { uuid } = route.params;
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [viewedAtLabel] = useState(() => formatFooterTimestamp(new Date()));

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

  const qrPayload = useMemo(() => {
    if (!booking) {
      return SITE_URL;
    }
    const ref = booking.bookingReference?.trim();
    if (ref) {
      return `${SITE_URL}/?ref=${encodeURIComponent(ref)}`;
    }
    return SITE_URL;
  }, [booking]);

  const qrUri = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrPayload)}`,
    [qrPayload],
  );

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={HEADER_BLUE} />
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
  const customerNameForSign =
    b.customerName?.trim() || b.user?.fullName?.trim() || bookingPassengerLabel(b);
  const displayCustomerName =
    b.customerName?.trim() || b.user?.fullName?.trim() || bookingPassengerLabel(b);

  const openPickupSign = () => {
    navigation.navigate('PickupSign', { customerName: customerNameForSign });
  };

  const openTel = () => {
    const p = b.customerPhone?.trim();
    if (!p) {
      return;
    }
    const href = `tel:${p.replace(/[^\d+]/g, '')}`;
    void Linking.openURL(href);
  };

  const openSms = () => {
    const p = b.customerPhone?.trim();
    if (!p) {
      return;
    }
    void Linking.openURL(smsUrl(p));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.appHeader, { paddingTop: insets.top }]}>
        <Text style={styles.headerRes} numberOfLines={1}>
          RES# {formatResNumber(b)}
        </Text>
        <Text style={styles.headerBrand} numberOfLines={1}>
          TAXIBARCELONAS
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.headerCloseBtn}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.headerHairline} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section title="Pickup Information">
          <InfoRow label="Pickup Address" value={bookingFromDisplay(b)} />
          <InfoRow label="Passengers" value={String(b.passengerCount)} />
          <InfoRow label="Pickup Date" value={formatPickupDate(b.scheduledTime)} />
          <InfoRow label="Pickup Time" value={formatPickupTime(b.scheduledTime)} />
        </Section>

        <Section title="Dropoff Information">
          <InfoRow label="Dropoff Address" value={bookingToDisplay(b)} />
        </Section>

        <Section title="Customer Information">
          <CustomerNameRow
            name={displayCustomerName}
            onEyePress={openPickupSign}
            onCopyName={async () => {
              const ok = await copyStringToClipboard(displayCustomerName);
              if (ok) {
                notifyCopiedAndroid();
              } else {
                Alert.alert('Copy failed', 'Could not copy to the clipboard.');
              }
            }}
          />
          {b.customerPhone?.trim() ? (
            <PhoneRow
              phone={b.customerPhone.trim()}
              onCall={openTel}
              onMessage={openSms}
              onCopy={async () => {
                const ok = await copyStringToClipboard(b.customerPhone!.trim());
                if (ok) {
                  notifyCopiedAndroid();
                } else {
                  Alert.alert('Copy failed', 'Could not copy to the clipboard.');
                }
              }}
            />
          ) : null}
          <BookingRefRow
            reference={b.bookingReference?.trim() || '—'}
            onCopy={async () => {
              const ref = b.bookingReference?.trim();
              if (!ref) {
                return;
              }
              const ok = await copyStringToClipboard(ref);
              if (ok) {
                notifyCopiedAndroid();
              } else {
                Alert.alert('Copy failed', 'Could not copy to the clipboard.');
              }
            }}
          />
        </Section>

        {b.note?.trim() ? (
          <View style={styles.noteWrap}>
            <Text style={styles.noteLabel}>Note</Text>
            <Text style={styles.noteBody}>{b.note.trim()}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" />
          <View style={styles.footerCenter}>
            <Text style={styles.footerSite}>www.taxibarcelonas.com</Text>
          </View>
          <Text style={styles.footerTime}>{viewedAtLabel}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function CustomerNameRow({
  name,
  onEyePress,
  onCopyName,
}: {
  name: string;
  onEyePress: () => void;
  onCopyName: () => void;
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

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Customer Name</Text>
      <View style={styles.valueWithIcons}>
        <Text style={styles.infoValueFlex} numberOfLines={3}>
          {name}
        </Text>
        <Pressable
          onPress={onEyePress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Show pickup sign with customer name"
          style={styles.iconBtn}
        >
          <Ionicons name="eye-outline" size={22} color={ICON_BLACK} />
        </Pressable>
        <Pressable
          onPress={async () => {
            await onCopyName();
            flashTick();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Copy customer name"
          style={styles.iconBtn}
        >
          <Ionicons
            name={showTick ? 'checkmark-circle' : 'copy-outline'}
            size={22}
            color={showTick ? colors.success : ICON_BLACK}
          />
        </Pressable>
      </View>
    </View>
  );
}

function PhoneRow({
  phone,
  onCall,
  onMessage,
  onCopy,
}: {
  phone: string;
  onCall: () => void;
  onMessage: () => void;
  onCopy: () => void;
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

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Phone Number</Text>
      <View style={styles.valueWithIcons}>
        <Pressable
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel="Call customer"
          style={styles.phoneCircle}
        >
          <Ionicons name="call" size={18} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.infoValueFlex} selectable>
          {phone}
        </Text>
        <Pressable
          onPress={onMessage}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Message customer"
          style={styles.iconBtn}
        >
          <Ionicons name="chatbubble-outline" size={22} color={ICON_BLACK} />
        </Pressable>
        <Pressable
          onPress={async () => {
            await onCopy();
            flashTick();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Copy phone number"
          style={styles.iconBtn}
        >
          <Ionicons
            name={showTick ? 'checkmark-circle' : 'copy-outline'}
            size={22}
            color={showTick ? colors.success : ICON_BLACK}
          />
        </Pressable>
      </View>
    </View>
  );
}

function BookingRefRow({ reference, onCopy }: { reference: string; onCopy: () => void }) {
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

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Booking Ref</Text>
      <View style={styles.valueWithIcons}>
        <Text style={styles.infoValueFlex} selectable>
          {reference}
        </Text>
        <Pressable
          onPress={async () => {
            await onCopy();
            flashTick();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Copy booking reference"
          style={styles.iconBtn}
        >
          <Ionicons
            name={showTick ? 'checkmark-circle' : 'copy-outline'}
            size={22}
            color={showTick ? colors.success : ICON_BLACK}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HEADER_BLUE,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  headerRes: {
    flexShrink: 0,
    maxWidth: '32%',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerBrand: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  headerCloseBtn: {
    flexShrink: 0,
    padding: spacing.xs,
  },
  headerHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 0,
  },
  section: {
    marginBottom: 0,
  },
  sectionBar: {
    backgroundColor: HEADER_BLUE,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  sectionBarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionBody: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    width: '38%',
    paddingRight: spacing.sm,
    fontWeight: '700',
    fontSize: 14,
    color: ICON_BLACK,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: ICON_BLACK,
  },
  infoValueFlex: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: ICON_BLACK,
    minWidth: 0,
  },
  valueWithIcons: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  phoneCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryMuted,
    marginBottom: spacing.xs,
  },
  noteBody: {
    ...typography.body,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  qr: {
    width: 88,
    height: 88,
    backgroundColor: colors.background,
  },
  footerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  footerSite: {
    fontSize: 13,
    color: FOOTER_MUTED,
    textAlign: 'center',
  },
  footerTime: {
    fontSize: 12,
    color: FOOTER_MUTED,
    flexShrink: 0,
  },
  error: { ...typography.body, color: colors.danger },
});
