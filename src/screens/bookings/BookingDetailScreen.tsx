import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { Screen } from '../../components';
import { BOOKING_TIME_ZONE } from '../../constants/timeZone';
import {
  formatBookingWallClockDate,
  formatDateOnly,
  formatTimeOnly,
} from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import {
  bookingChildSeatsSummary,
  bookingDetailAccentColor,
  bookingFromDisplay,
  bookingHasReturnTrip,
  bookingPassengerLabel,
  bookingReturnTimeIso,
  bookingSourceAccessibilityLabel,
  bookingSourceIcon,
  bookingToDisplay,
  dropoffDepartureDisplay,
  dropoffReturnFlightInfo,
  isAppBooking,
  isDropoffAirportBooking,
  isPickupAirportBooking,
  isWebsiteBooking,
  pickupArrivalAirline,
  pickupArrivalFlight,
} from '../../lib/bookingFormat';
import { getAppUiMessage } from '../../lib/apiErrors';
import { logger } from '../../lib/logger';
import { phoneForDisplay } from '../../lib/phoneFormat';
import type { BookingDetailHostStackParamList } from '../../navigation/types';
import { brandDisplayName } from '../../navigation/driverChrome';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import type { Booking } from '../../types/booking';
import { colors, spacing } from '../../theme';

type BookingDetailParams = { BookingDetail: { uuid: string } };

const COPY_TICK_MS = 1600;
const HEADER_BLUE = '#2196F3';
const ICON_BLACK = '#111827';
const FOOTER_MUTED = '#9CA3AF';
const SITE_URL = 'https://barcelonataxi24.com/';
const SITE_DISPLAY = 'www.barcelonataxi24.com';
const ICON_SIZE = 24;
const HEADER_ICON_SIZE = 26;
const QR_PX = 68;
const ROW_FONT = 17;
const ROW_LINE = 21;
const LABEL_COL_W = 148;

function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function notifyCopiedAndroid() {
  if (Platform.OS === 'android') {
    ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
  }
}

function notifySavedToGallery() {
  if (Platform.OS === 'android') {
    ToastAndroid.show('Saved to gallery', ToastAndroid.SHORT);
  } else {
    Alert.alert('Saved', 'Screenshot saved to your photo library.');
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
  return formatBookingWallClockDate(iso) ?? formatDateOnly(iso);
}

function formatPickupTime(iso: string): string {
  return formatTimeOnly(iso);
}

function formatReturnDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: BOOKING_TIME_ZONE,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatReturnTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: BOOKING_TIME_ZONE,
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

function whatsappUrl(phone: string): string {
  const core = phone.replace(/[^\d+]/g, '');
  const digitsOnly = core.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}`;
}

function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function BookingDetailScreen() {
  const route = useRoute<RouteProp<BookingDetailParams, 'BookingDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<BookingDetailHostStackParamList, 'BookingDetail'>>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { uuid } = route.params;
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [viewedAtLabel] = useState(() => formatFooterTimestamp(new Date()));
  const [savingScreenshot, setSavingScreenshot] = useState(false);
  const screenshotRef = useRef<ViewShot>(null);

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
      setError(getAppUiMessage(e, 'Could not load booking. Please try again.'));
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
      Alert.alert('Could not update', getAppUiMessage(e, 'Please try again.'));
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
      Alert.alert('Could not update', getAppUiMessage(e, 'Please try again.'));
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

  const onSaveScreenshot = useCallback(async () => {
    if (savingScreenshot) {
      return;
    }
    setSavingScreenshot(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow access to your photos so booking screenshots can be saved to the gallery.',
        );
        return;
      }

      const shotRef = screenshotRef.current;
      if (!shotRef) {
        Alert.alert('Could not save', 'Screenshot is not ready yet. Try again.');
        return;
      }

      const uri = await captureRef(shotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      notifySavedToGallery();
    } catch (e) {
      logger.warn('BookingDetailScreen: screenshot save failed', e);
      Alert.alert(
        'Could not save',
        getAppUiMessage(e, 'Failed to save screenshot to the gallery.'),
      );
    } finally {
      setSavingScreenshot(false);
    }
  }, [savingScreenshot]);

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
  const sourceIcon = bookingSourceIcon(b);
  const sourceLabel = bookingSourceAccessibilityLabel(b);
  const accentColor = bookingDetailAccentColor(b);
  const displayPhone = b.customerPhone?.trim()
    ? phoneForDisplay(b.customerPhone.trim())
    : '';

  const openPickupSign = () => {
    navigation.navigate('PickupSign', { customerName: customerNameForSign });
  };

  const openTel = () => {
    if (!displayPhone) {
      return;
    }
    const href = `tel:${displayPhone.replace(/[^\d+]/g, '')}`;
    void Linking.openURL(href);
  };

  const openSms = () => {
    if (!displayPhone) {
      return;
    }
    void Linking.openURL(whatsappUrl(displayPhone));
  };

  const scrollMinHeight = windowHeight - insets.bottom;

  const bodyMinHeight = scrollMinHeight - insets.top - 48;
  const dropoffAddress = bookingToDisplay(b);
  const dropoffFlightInfo = dropoffReturnFlightInfo(b);
  const dropoffDeparture = dropoffDepartureDisplay(b);
  const childSeats = bookingChildSeatsSummary(b);
  const arrivalFlight = pickupArrivalFlight(b);
  const arrivalAirline = pickupArrivalAirline(b);
  const returnTimeIso = bookingReturnTimeIso(b);
  const hasReturnTrip = bookingHasReturnTrip(b);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: scrollMinHeight, paddingBottom: insets.bottom + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ViewShot
          ref={screenshotRef}
          collapsable={false}
          options={{ format: 'png', quality: 1 }}
          style={[styles.screenshotCapture, { minHeight: scrollMinHeight }]}
        >
          <View style={[styles.appHeader, { paddingTop: insets.top, backgroundColor: accentColor }]}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerRes} numberOfLines={1}>
                RES# {formatResNumber(b)}
              </Text>
              <Ionicons
                name={sourceIcon}
                size={HEADER_ICON_SIZE}
                color="#FFFFFF"
                accessibilityLabel={sourceLabel}
              />
            </View>
            <Text style={styles.headerBrand} numberOfLines={1}>
              {brandDisplayName}
            </Text>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => void onSaveScreenshot()}
                disabled={savingScreenshot}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Save screenshot to gallery"
                style={styles.headerActionBtn}
              >
                {savingScreenshot ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={HEADER_ICON_SIZE} color="#FFFFFF" />
                )}
              </Pressable>
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.headerActionBtn}
              >
                <Ionicons name="close" size={HEADER_ICON_SIZE + 2} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          <View style={styles.headerHairline} />

          <View style={[styles.fillColumn, { minHeight: bodyMinHeight }]}>
            <View style={styles.sectionsBlock}>
              <Section title="Pickup Information" accentColor={accentColor}>
                <InfoRow label="Pickup Address" value={bookingFromDisplay(b)} />
                <InfoRow label="Passengers" value={String(b.passengerCount)} />
                {isWebsiteBooking(b) ? (
                  <InfoRow label="Luggage" value={String(b.luggageCount)} />
                ) : null}
                <InfoRow label="Pickup Date" value={formatPickupDate(b.scheduledTime)} />
                <InfoRow
                  label="Pickup Time"
                  value={formatPickupTime(b.scheduledTime)}
                  valueBold
                />
                {isPickupAirportBooking(b) || arrivalFlight || arrivalAirline ? (
                  <>
                    <InfoRow label="Arrival airline" value={arrivalAirline ?? '—'} />
                    <InfoRow label="Arrival flight" value={arrivalFlight ?? '—'} />
                  </>
                ) : null}
                {isDropoffAirportBooking(b) ||
                dropoffFlightInfo?.flight ||
                dropoffFlightInfo?.airline ||
                dropoffDeparture ? (
                  <>
                    <InfoRow label="Departure airline" value={dropoffFlightInfo?.airline ?? '—'} />
                    <InfoRow label="Departure flight" value={dropoffFlightInfo?.flight ?? '—'} />
                    {!isAppBooking(b) && dropoffDeparture?.dateIso ? (
                      <InfoRow
                        label="Departure Date"
                        value={formatReturnDate(dropoffDeparture.dateIso)}
                      />
                    ) : null}
                    <InfoRow
                      label="Departure Time"
                      value={
                        dropoffDeparture?.timeIso
                          ? formatReturnTime(dropoffDeparture.timeIso)
                          : dropoffDeparture?.timeLabel ?? '—'
                      }
                    />
                  </>
                ) : null}
                {childSeats ? <InfoRow label="Child seats" value={childSeats} /> : null}
                {hasReturnTrip && returnTimeIso ? (
                  <>
                    <InfoRow label="Return Date" value={formatReturnDate(returnTimeIso)} />
                    <InfoRow
                      label="Return Time"
                      value={formatReturnTime(returnTimeIso)}
                      valueBold
                    />
                  </>
                ) : null}
                <InfoRow label="Notes" value={b.note?.trim() || 'No'} />
              </Section>

              <Section title="Dropoff Information" accentColor={accentColor}>
                <InfoRow
                  label="Dropoff Address"
                  value={dropoffAddress}
                  accentColor={accentColor}
                  onPress={
                    dropoffAddress && dropoffAddress !== '—'
                      ? () => {
                        void Linking.openURL(googleMapsSearchUrl(dropoffAddress));
                      }
                      : undefined
                  }
                />
              </Section>

              <Section title="Customer Information" accentColor={accentColor}>
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
                {displayPhone ? (
                  <PhoneRow
                    phone={displayPhone}
                    onCall={openTel}
                    onMessage={openSms}
                    onCopy={async () => {
                      const ok = await copyStringToClipboard(displayPhone);
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


            </View>

            <View style={styles.footer}>
              <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" />
              <View style={styles.footerCenter}>
                <Text style={styles.footerSite}>{SITE_DISPLAY}</Text>
              </View>
              <Text style={styles.footerTime}>{viewedAtLabel}</Text>
            </View>
          </View>
        </ViewShot>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  accentColor,
}: {
  title: string;
  children: ReactNode;
  accentColor: string;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.sectionBar, { backgroundColor: accentColor }]}>
        <Text style={styles.sectionBarText}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  onPress,
  valueBold,
  accentColor = HEADER_BLUE,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  valueBold?: boolean;
  accentColor?: string;
}) {
  const valueStyle = [
    styles.infoValue,
    valueBold ? styles.infoValueBold : null,
    onPress ? [styles.infoValueLink, { color: accentColor }] : null,
  ];
  const content = (
    <>
      <Text style={styles.infoLabel}>{toTitleCase(label)}:</Text>
      <Text style={valueStyle}>{value}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.infoRow}>{content}</View>;
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.infoRow, pressed ? styles.infoRowPressed : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open in Google Maps`}
    >
      {content}
    </Pressable>
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
      <Text style={styles.infoLabel}>{toTitleCase('Customer Name')}:</Text>
      <View style={styles.valueWithIcons}>
        <Text style={styles.infoValueFlex} numberOfLines={2}>
          {name}
        </Text>
        <Pressable
          onPress={onEyePress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Show pickup sign with customer name"
          style={styles.iconBtn}
        >
          <Ionicons name="eye" size={30} color={ICON_BLACK} />
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
            name={showTick ? 'checkmark-circle' : 'copy'}
            size={ICON_SIZE}
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
      <Text style={styles.infoLabel}>{toTitleCase('Phone Number')}:</Text>
      <View style={styles.valueWithIcons}>
        <Pressable
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel="Call customer"
          style={styles.phoneCircle}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.infoValueFlex} selectable>
          {phone}
        </Text>
        <Pressable
          onPress={onMessage}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Message customer on WhatsApp"
          style={styles.iconBtn}
        >
          <Ionicons name="logo-whatsapp" size={ICON_SIZE} color={ICON_BLACK} />
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
            name={showTick ? 'checkmark-circle' : 'copy'}
            size={ICON_SIZE}
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
      <Text style={styles.infoLabel}>{toTitleCase('Booking Ref')}:</Text>
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
            name={showTick ? 'checkmark-circle' : 'copy'}
            size={ICON_SIZE}
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
  scroll: {
    flex: 1,
  },
  screenshotCapture: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  fillColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sectionsBlock: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: spacing.xs,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 8,
    gap: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
    maxWidth: '32%',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRes: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerBrand: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  headerHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 0,
  },
  sectionBar: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sectionBarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  sectionBody: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    marginBottom: 0,
  },
  infoRowPressed: {
    opacity: 0.7,
  },
  infoLabel: {
    width: LABEL_COL_W,
    paddingRight: 4,
    fontWeight: '700',
    fontSize: ROW_FONT,
    lineHeight: ROW_LINE,
    color: ICON_BLACK,
  },
  infoValue: {
    flex: 1,
    flexShrink: 1,
    fontSize: ROW_FONT,
    fontWeight: '400',
    color: ICON_BLACK,
    lineHeight: ROW_LINE,
  },
  infoValueBold: {
    fontWeight: '700',
  },
  infoValueLink: {
    textDecorationLine: 'underline',
  },
  infoValueFlex: {
    flex: 1,
    fontSize: ROW_FONT,
    fontWeight: '400',
    color: ICON_BLACK,
    lineHeight: ROW_LINE,
    minWidth: 0,
  },
  valueWithIcons: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  iconBtn: {
    padding: 2,
  },
  phoneCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  qr: {
    width: QR_PX,
    height: QR_PX,
    backgroundColor: colors.background,
  },
  footerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  footerSite: {
    fontSize: 12,
    color: FOOTER_MUTED,
    textAlign: 'center',
  },
  footerTime: {
    fontSize: 11,
    fontStyle: 'italic',
    color: FOOTER_MUTED,
    flexShrink: 0,
  },
  error: { fontSize: 17, color: colors.danger },
});
