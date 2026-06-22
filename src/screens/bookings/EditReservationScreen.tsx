import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { getAppUiMessage } from '../../lib/apiErrors';
import {
  bookingDropoffLabel,
  bookingPickupLabel,
  bookingReturnTimeIso,
  isDropoffAirportBooking,
  isPickupAirportBooking,
  pickupArrivalFlight,
} from '../../lib/bookingFormat';
import { phoneForDisplay } from '../../lib/phoneFormat';
import {
  bookingPickerDatesFromIso,
  combineBookingDateAndTimeToIso,
} from '../../lib/pickupDateTime';
import { getDriverRootNavigation } from '../../navigation/getDriverRootNavigation';
import type { BookingDetailHostStackParamList } from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import type { Booking } from '../../types/booking';
import { spacing, typography } from '../../theme';

const brandBlue = '#1E88E5';

/** Extra scroll space so fields stay above the keyboard. */
const KEYBOARD_SCROLL_EXTRA_PAD = 280;

const MAX_PASSENGERS_EDIT = 25;
const darkerBlue = '#1565C0';
const FIXED_AIRPORT_LABEL = 'Barcelona-El Prat Airport';
const BARCELONA_AIRPORT_LABEL = /^Barcelona[- ]?El Prat/i;

function normalizeAirportLabelForEdit(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return FIXED_AIRPORT_LABEL;
  }
  if (BARCELONA_AIRPORT_LABEL.test(trimmed)) {
    return FIXED_AIRPORT_LABEL;
  }
  return trimmed;
}

function pickupMeetingAddressFromJson(pickupLocation: unknown): string {
  const meeting = jsonString(pickupLocation, 'meetingAddress').trim();
  if (!meeting) {
    return '';
  }
  const label = jsonString(pickupLocation, 'label').trim();
  const normalizedLabel = normalizeAirportLabelForEdit(label);
  if (meeting === label || meeting === normalizedLabel) {
    return '';
  }
  return meeting;
}

type LocationKind = 'location' | 'airport';

type PickerTarget = 'time' | 'date' | 'dropoffTime' | null;

type Nav = NavigationProp<BookingDetailHostStackParamList>;
type Route = RouteProp<BookingDetailHostStackParamList, 'EditReservation'>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateDash(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function dayOrdinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatDateOrdinalLine(d: Date): string {
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${month} ${dayOrdinal(d.getDate())}, ${d.getFullYear()}`;
}

function formatTime24(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function timeFromDepartureLabel(label: string, fallback: Date): Date {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return fallback;
  }
  const next = new Date(fallback);
  next.setHours(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), 0, 0);
  return next;
}

function formatTime12(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function readJsonRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function jsonKind(v: unknown): string | undefined {
  const k = readJsonRecord(v)?.kind;
  return typeof k === 'string' ? k : undefined;
}

function jsonString(v: unknown, key: string): string {
  const o = readJsonRecord(v);
  const x = o?.[key];
  return typeof x === 'string' ? x : '';
}

function FormFieldSlot({
  fieldId,
  onLayout,
  children,
}: {
  fieldId: string;
  onLayout: (id: string, y: number, height: number) => void;
  children: ReactNode;
}) {
  return (
    <View
      collapsable={false}
      onLayout={(e: LayoutChangeEvent) => {
        const { y, height } = e.nativeEvent.layout;
        onLayout(fieldId, y, height);
      }}
    >
      {children}
    </View>
  );
}

export function EditReservationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { uuid } = route.params;
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const fieldMetrics = useRef<Record<string, { y: number; height: number }>>({});
  const lastFocusedField = useRef<string | null>(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingRefDisplay, setBookingRefDisplay] = useState('');
  const [customerEmailKeep, setCustomerEmailKeep] = useState('');

  const [puTime, setPuTime] = useState(() => new Date());
  const [puDate, setPuDate] = useState(() => new Date());
  const [passengerCount, setPassengerCount] = useState(1);

  const [pickupKind, setPickupKind] = useState<LocationKind>('location');
  const [pickupDetail, setPickupDetail] = useState('');
  const [pickupAirportLabel, setPickupAirportLabel] = useState(FIXED_AIRPORT_LABEL);
  const [pickupAirline, setPickupAirline] = useState('');
  const [pickupFlight, setPickupFlight] = useState('');
  const [pickupMeeting, setPickupMeeting] = useState('');

  const [dropoffKind, setDropoffKind] = useState<LocationKind>('location');
  /** When drop-off is Location: simple street vs airport-destination row (mock). */
  const [dropoffSimpleStreet, setDropoffSimpleStreet] = useState(false);
  const [dropoffDetail, setDropoffDetail] = useState('');
  const [dropoffAirportLabel, setDropoffAirportLabel] = useState(FIXED_AIRPORT_LABEL);
  const [dropoffAirline, setDropoffAirline] = useState('');
  const [dropoffFlight, setDropoffFlight] = useState('');
  const [dropoffTime, setDropoffTime] = useState(() => new Date());

  const [notes, setNotes] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [submitting, setSubmitting] = useState(false);

  const goToBookingsList = useCallback(() => {
    const rootNav = getDriverRootNavigation(navigation);
    if (rootNav) {
      rootNav.navigate('Bookings', { screen: 'BookingsList' });
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const scheduledIso = useMemo(
    () => combineBookingDateAndTimeToIso(puDate, puTime),
    [puDate, puTime],
  );

  const hydrate = useCallback((b: Booking) => {
    const { date, time } = bookingPickerDatesFromIso(b.scheduledTime);
    setPuDate(date);
    setPuTime(time);
    setPassengerCount(Math.min(MAX_PASSENGERS_EDIT, Math.max(1, b.passengerCount)));
    setFullName(b.customerName?.trim() || b.user?.fullName || '');
    const rawPhone = b.customerPhone?.trim() || b.user?.phone || '';
    setPhone(rawPhone ? phoneForDisplay(rawPhone) : '');
    setBookingRefDisplay(b.bookingReference);
    setCustomerEmailKeep((b.customerEmail || b.user?.email || '').trim());
    setNotes(b.note ?? '');

    const pk = jsonKind(b.pickupLocation);
    const pickupIsAirport = isPickupAirportBooking(b) || pk === 'airport';
    if (pickupIsAirport) {
      setPickupKind('airport');
      const pickupLabel = jsonString(b.pickupLocation, 'label');
      setPickupAirportLabel(normalizeAirportLabelForEdit(pickupLabel || FIXED_AIRPORT_LABEL));
      setPickupAirline(jsonString(b.pickupLocation, 'airline'));
      setPickupFlight(
        jsonString(b.pickupLocation, 'flight') || pickupArrivalFlight(b) || '',
      );
      setPickupMeeting(pickupMeetingAddressFromJson(b.pickupLocation));
      setPickupDetail('');
    } else {
      setPickupKind('location');
      setPickupDetail(bookingPickupLabel(b));
      setPickupAirportLabel(FIXED_AIRPORT_LABEL);
      setPickupAirline('');
      setPickupFlight('');
      setPickupMeeting('');
    }

    const dk = jsonKind(b.dropoffLocation);
    const dropoffIsAirport = isDropoffAirportBooking(b) || dk === 'airport';
    if (dropoffIsAirport) {
      setDropoffKind('airport');
      setDropoffSimpleStreet(false);
      setDropoffAirportLabel(jsonString(b.dropoffLocation, 'label') || FIXED_AIRPORT_LABEL);
      setDropoffDetail('');
      setDropoffAirline(jsonString(b.dropoffLocation, 'airline'));
      setDropoffFlight(
        jsonString(b.dropoffLocation, 'flight') || b.flightNumber?.trim() || '',
      );
      const departureTimeLabel = jsonString(b.dropoffLocation, 'departureTime');
      const returnIso = bookingReturnTimeIso(b);
      if (departureTimeLabel) {
        setDropoffTime(timeFromDepartureLabel(departureTimeLabel, time));
      } else if (returnIso) {
        setDropoffTime(bookingPickerDatesFromIso(returnIso).time);
      } else {
        setDropoffTime(time);
      }
    } else {
      setDropoffKind('location');
      const label = jsonString(b.dropoffLocation, 'label');
      const da = jsonString(b.dropoffLocation, 'airline');
      const df = jsonString(b.dropoffLocation, 'flight');
      const isFixed = label === FIXED_AIRPORT_LABEL;
      if (!isFixed && !da && !df && !bookingReturnTimeIso(b)) {
        setDropoffSimpleStreet(true);
        setDropoffAirportLabel(FIXED_AIRPORT_LABEL);
        setDropoffDetail(label || bookingDropoffLabel(b));
        setDropoffAirline('');
        setDropoffFlight('');
      } else {
        setDropoffSimpleStreet(false);
        setDropoffAirportLabel(label || FIXED_AIRPORT_LABEL);
        setDropoffAirline(da);
        setDropoffFlight(df);
        setDropoffDetail('');
        setDropoffTime(
          bookingReturnTimeIso(b)
            ? bookingPickerDatesFromIso(bookingReturnTimeIso(b)!).time
            : time,
        );
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!accessToken) {
        setLoadError('Not signed in.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const b = await bookingsApi.getByUuid(accessToken, uuid);
        if (!cancelled) {
          hydrate(b);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(getAppUiMessage(e, 'Could not load booking. Please try again.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, uuid, hydrate]);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') {
        setPickerTarget(null);
        if (event.type === 'dismissed') {
          return;
        }
      }
      if (!selected) {
        return;
      }
      if (pickerTarget === 'time') {
        setPuTime(selected);
      } else if (pickerTarget === 'date') {
        setPuDate(selected);
      } else if (pickerTarget === 'dropoffTime') {
        setDropoffTime(selected);
      }
    },
    [pickerTarget],
  );

  const adjustPassengers = useCallback((delta: number) => {
    setPassengerCount((n) => Math.min(MAX_PASSENGERS_EDIT, Math.max(1, n + delta)));
  }, []);

  const save = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const name = fullName.trim();
    const phoneTrim = phone.trim();
    if (!name || !phoneTrim) {
      Alert.alert('Required', 'Please enter full name and phone number.');
      return;
    }
    if (!customerEmailKeep.trim()) {
      Alert.alert('Required', 'Booking is missing a customer email in our records.');
      return;
    }
    let pickupLocation: Record<string, unknown>;
    if (pickupKind === 'location') {
      pickupLocation = {
        kind: 'location',
        label: pickupDetail.trim() || 'Address TBC',
      };
    } else {
      const pa = pickupAirline.trim();
      const pf = pickupFlight.trim();
      const meet = pickupMeeting.trim();
      pickupLocation = {
        kind: 'airport',
        label: pickupAirportLabel.trim() || FIXED_AIRPORT_LABEL,
      };
      if (meet) {
        pickupLocation.meetingAddress = meet;
      }
      if (pa) {
        pickupLocation.airline = pa;
      }
      if (pf) {
        pickupLocation.flight = pf;
      }
    }

    let dropoffLocation: Record<string, unknown>;
    let returnTime: string | null | undefined;

    if (dropoffKind === 'airport') {
      dropoffLocation = {
        kind: 'airport',
        label: dropoffAirportLabel.trim() || FIXED_AIRPORT_LABEL,
      };
      const da = dropoffAirline.trim();
      const df = dropoffFlight.trim();
      if (da) {
        dropoffLocation.airline = da;
      }
      if (df) {
        dropoffLocation.flight = df;
      }
      dropoffLocation.departureTime = formatTime24(dropoffTime);
      returnTime = null;
    } else if (dropoffSimpleStreet) {
      dropoffLocation = {
        kind: 'location',
        label: dropoffDetail.trim() || 'Address TBC',
      };
      returnTime = null;
    } else {
      dropoffLocation = {
        kind: 'location',
        label: dropoffAirportLabel.trim() || FIXED_AIRPORT_LABEL,
      };
      const da = dropoffAirline.trim();
      const df = dropoffFlight.trim();
      if (da) {
        dropoffLocation.airline = da;
      }
      if (df) {
        dropoffLocation.flight = df;
      }
      returnTime = combineBookingDateAndTimeToIso(puDate, dropoffTime);
    }

    const flightNumber =
      pickupKind === 'airport'
        ? [pickupAirline.trim(), pickupFlight.trim()].filter(Boolean).join(' ').trim() || undefined
        : undefined;

    setSubmitting(true);
    try {
      await bookingsApi.update(accessToken, uuid, {
        customerName: name,
        customerPhone: phoneTrim,
        customerEmail: customerEmailKeep.trim(),
        pickupLocation,
        dropoffLocation,
        scheduledTime: scheduledIso,
        passengerCount,
        flightNumber,
        returnTime,
        note: notes.trim() || null,
      });
      goToBookingsList();
    } catch (e) {
      Alert.alert('Update failed', getAppUiMessage(e, 'Could not save changes. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }, [
    accessToken,
    uuid,
    fullName,
    phone,
    customerEmailKeep,
    pickupKind,
    pickupDetail,
    pickupAirline,
    pickupFlight,
    pickupAirportLabel,
    pickupMeeting,
    dropoffKind,
    dropoffSimpleStreet,
    dropoffDetail,
    dropoffAirportLabel,
    dropoffAirline,
    dropoffFlight,
    dropoffTime,
    puDate,
    notes,
    passengerCount,
    scheduledIso,
    goToBookingsList,
    navigation,
  ]);

  const onPickupKind = useCallback((k: LocationKind) => {
    setPickupKind(k);
    if (k === 'location') {
      setPickupAirline('');
      setPickupFlight('');
      setPickupMeeting('');
    }
  }, []);

  const onDropoffKind = useCallback((k: LocationKind) => {
    setDropoffKind(k);
    if (k === 'airport') {
      setDropoffSimpleStreet(false);
      setDropoffDetail('');
    } else {
      setDropoffSimpleStreet(false);
      setDropoffDetail('');
    }
  }, []);

  const onFieldLayout = useCallback((id: string, y: number, height: number) => {
    fieldMetrics.current[id] = { y, height };
  }, []);

  const scrollFocusedFieldIntoView = useCallback((id: string) => {
    const m = fieldMetrics.current[id];
    if (!m || !scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTo({
      y: Math.max(0, m.y - spacing.lg),
      animated: true,
    });
  }, []);

  const onFieldFocus = useCallback(
    (id: string) => {
      lastFocusedField.current = id;
      if (keyboardBottomInset > 0) {
        scrollFocusedFieldIntoView(id);
      }
    },
    [keyboardBottomInset, scrollFocusedFieldIntoView],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardBottomInset(e.endCoordinates.height);
      const id = lastFocusedField.current;
      if (id) {
        const delay = Platform.OS === 'ios' ? 50 : 100;
        setTimeout(() => scrollFocusedFieldIntoView(id), delay);
      }
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardBottomInset(0);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [scrollFocusedFieldIntoView]);

  const keyboardOpen = keyboardBottomInset > 0;

  const scrollBottomPad = useMemo(() => {
    const basePad = spacing.xxl + insets.bottom + spacing.xl + spacing.xxl;
    if (!keyboardOpen) {
      return basePad;
    }
    return basePad + KEYBOARD_SCROLL_EXTRA_PAD + keyboardBottomInset;
  }, [insets.bottom, keyboardBottomInset, keyboardOpen]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandBlue} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled
        showsVerticalScrollIndicator={keyboardOpen}
        nestedScrollEnabled
      >
        <View style={styles.formBody}>
          <FormFieldSlot fieldId="fullName" onLayout={onFieldLayout}>
            <TextInput
              style={styles.textField}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => onFieldFocus('fullName')}
              autoCapitalize="characters"
            />
          </FormFieldSlot>
          <FormFieldSlot fieldId="phone" onLayout={onFieldLayout}>
            <TextInput
              style={styles.textField}
              placeholder="Phone Number"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              onFocus={() => onFieldFocus('phone')}
              keyboardType="phone-pad"
            />
          </FormFieldSlot>
          <TextInput
            style={[styles.textField, styles.readOnlyField]}
            placeholder="Booking Reference"
            placeholderTextColor="#9CA3AF"
            value={bookingRefDisplay}
            editable={false}
          />

          <View style={styles.blueBarThree}>
            <Pressable style={styles.blueBarThird} onPress={() => setPickerTarget('time')}>
              <Text style={styles.timePrimary}>{formatTime24(puTime)}</Text>
              <Text style={styles.timeSecondary}>{formatTime12(puTime)}</Text>
            </Pressable>
            <Pressable style={[styles.blueBarThird, styles.barDividerLeft]} onPress={() => setPickerTarget('date')}>
              <Text style={styles.timePrimary}>{formatDateDash(puDate)}</Text>
              <Text style={styles.timeSecondary}>{formatDateOrdinalLine(puDate)}</Text>
            </Pressable>
            <View style={[styles.blueBarThird, styles.barDividerLeft, styles.passengerColumn]}>
              <View style={styles.passengerStepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease passengers"
                  accessibilityState={{ disabled: passengerCount <= 1 }}
                  disabled={passengerCount <= 1}
                  hitSlop={8}
                  onPress={() => adjustPassengers(-1)}
                  style={({ pressed }) => [
                    styles.passengerStepBtn,
                    pressed && passengerCount > 1 && styles.passengerStepPressed,
                  ]}
                >
                  <Ionicons
                    name="remove"
                    size={22}
                    color={passengerCount <= 1 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                  />
                </Pressable>
                <Text style={styles.passengerCountLarge}>{passengerCount}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase passengers"
                  accessibilityState={{ disabled: passengerCount >= MAX_PASSENGERS_EDIT }}
                  disabled={passengerCount >= MAX_PASSENGERS_EDIT}
                  hitSlop={8}
                  onPress={() => adjustPassengers(1)}
                  style={({ pressed }) => [
                    styles.passengerStepBtn,
                    pressed && passengerCount < MAX_PASSENGERS_EDIT && styles.passengerStepPressed,
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={passengerCount >= MAX_PASSENGERS_EDIT ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.locationBlueBar}>
            <Text style={styles.locationBlueTitle}>PICK UP</Text>
            <View style={styles.segmentGroup}>
              <Pressable
                onPress={() => onPickupKind('location')}
                style={[styles.segment, pickupKind === 'location' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, pickupKind === 'location' && styles.segmentTextSelected]}>
                  Location
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onPickupKind('airport')}
                style={[styles.segment, pickupKind === 'airport' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, pickupKind === 'airport' && styles.segmentTextSelected]}>
                  Airport
                </Text>
              </Pressable>
            </View>
          </View>

          {pickupKind === 'location' ? (
            <FormFieldSlot fieldId="pickupDetail" onLayout={onFieldLayout}>
              <TextInput
                style={styles.textField}
                placeholder="Street / area"
                placeholderTextColor="#9CA3AF"
                value={pickupDetail}
                onChangeText={setPickupDetail}
                onFocus={() => onFieldFocus('pickupDetail')}
              />
            </FormFieldSlot>
          ) : (
            <>
              <FormFieldSlot fieldId="pickupAirline" onLayout={onFieldLayout}>
                <View style={styles.airportSplitBar}>
                  <TextInput
                    style={styles.airportSplitInput}
                    placeholder="Airline (optional)"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    value={pickupAirline}
                    onChangeText={setPickupAirline}
                    onFocus={() => onFieldFocus('pickupAirline')}
                    autoCapitalize="characters"
                  />
                  <View style={styles.airportSplitDivider} />
                  <TextInput
                    style={styles.airportSplitInput}
                    placeholder="Flight (optional)"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    value={pickupFlight}
                    onChangeText={setPickupFlight}
                    onFocus={() => onFieldFocus('pickupAirline')}
                    autoCapitalize="characters"
                  />
                </View>
              </FormFieldSlot>
              <FormFieldSlot fieldId="pickupAirport" onLayout={onFieldLayout}>
                <TextInput
                  style={styles.darkerBarInput}
                  placeholder="Airport name"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  value={pickupAirportLabel}
                  onChangeText={setPickupAirportLabel}
                  onFocus={() => onFieldFocus('pickupAirport')}
                />
              </FormFieldSlot>
              <FormFieldSlot fieldId="pickupMeeting" onLayout={onFieldLayout}>
                <TextInput
                  style={styles.darkerBarInput}
                  placeholder="Street / meeting point"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  value={pickupMeeting}
                  onChangeText={setPickupMeeting}
                  onFocus={() => onFieldFocus('pickupMeeting')}
                />
              </FormFieldSlot>
            </>
          )}

          <View style={styles.locationBlueBar}>
            <Text style={styles.locationBlueTitle}>DROP OFF</Text>
            <View style={styles.segmentGroup}>
              <Pressable
                onPress={() => onDropoffKind('location')}
                style={[styles.segment, dropoffKind === 'location' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, dropoffKind === 'location' && styles.segmentTextSelected]}>
                  Location
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDropoffKind('airport')}
                style={[styles.segment, dropoffKind === 'airport' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, dropoffKind === 'airport' && styles.segmentTextSelected]}>
                  Airport
                </Text>
              </Pressable>
            </View>
          </View>

          {dropoffKind === 'airport' ? (
            <>
              <FormFieldSlot fieldId="dropoffAirline" onLayout={onFieldLayout}>
                <View style={styles.airportTripleBar}>
                  <View style={styles.tripleCell}>
                    <Text style={styles.tripleHint}>Airline</Text>
                    <TextInput
                      style={styles.tripleInput}
                      placeholder="Airline"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={dropoffAirline}
                      onChangeText={setDropoffAirline}
                      onFocus={() => onFieldFocus('dropoffAirline')}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.tripleDivider} />
                  <View style={styles.tripleCell}>
                    <Text style={styles.tripleHint}>Flight (optional)</Text>
                    <TextInput
                      style={styles.tripleInput}
                      placeholder="Flight (optional)"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={dropoffFlight}
                      onChangeText={setDropoffFlight}
                      onFocus={() => onFieldFocus('dropoffAirline')}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.tripleDivider} />
                  <Pressable style={styles.tripleCell} onPress={() => setPickerTarget('dropoffTime')}>
                    <Text style={styles.tripleHint}>Time</Text>
                    <Text style={styles.tripleTime}>{formatTime24(dropoffTime)}</Text>
                    <Text style={styles.tripleTimeSmall}>{formatTime12(dropoffTime)}</Text>
                  </Pressable>
                </View>
              </FormFieldSlot>
              <FormFieldSlot fieldId="dropoffAirport" onLayout={onFieldLayout}>
                <TextInput
                  style={styles.darkerBarInput}
                  placeholder="Airport name"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  value={dropoffAirportLabel}
                  onChangeText={setDropoffAirportLabel}
                  onFocus={() => onFieldFocus('dropoffAirport')}
                />
              </FormFieldSlot>
            </>
          ) : dropoffSimpleStreet ? (
            <FormFieldSlot fieldId="dropoffDetail" onLayout={onFieldLayout}>
              <TextInput
                style={styles.textField}
                placeholder="Street / area (optional)"
                placeholderTextColor="#9CA3AF"
                value={dropoffDetail}
                onChangeText={setDropoffDetail}
                onFocus={() => onFieldFocus('dropoffDetail')}
              />
            </FormFieldSlot>
          ) : (
            <>
              <FormFieldSlot fieldId="dropoffAirline" onLayout={onFieldLayout}>
                <View style={styles.airportTripleBar}>
                  <View style={styles.tripleCell}>
                    <Text style={styles.tripleHint}>Airline</Text>
                    <TextInput
                      style={styles.tripleInput}
                      placeholder="Airline"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={dropoffAirline}
                      onChangeText={setDropoffAirline}
                      onFocus={() => onFieldFocus('dropoffAirline')}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.tripleDivider} />
                  <View style={styles.tripleCell}>
                    <Text style={styles.tripleHint}>Flight (optional)</Text>
                    <TextInput
                      style={styles.tripleInput}
                      placeholder="Flight (optional)"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={dropoffFlight}
                      onChangeText={setDropoffFlight}
                      onFocus={() => onFieldFocus('dropoffAirline')}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.tripleDivider} />
                  <Pressable style={styles.tripleCell} onPress={() => setPickerTarget('dropoffTime')}>
                    <Text style={styles.tripleHint}>Time</Text>
                    <Text style={styles.tripleTime}>{formatTime24(dropoffTime)}</Text>
                    <Text style={styles.tripleTimeSmall}>{formatTime12(dropoffTime)}</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.darkerBarInput}
                  placeholder="Airport name"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  value={dropoffAirportLabel}
                  onChangeText={setDropoffAirportLabel}
                  onFocus={() => onFieldFocus('dropoffAirport')}
                />
              </FormFieldSlot>
            </>
          )}

          <FormFieldSlot fieldId="notes" onLayout={onFieldLayout}>
            <TextInput
              style={[styles.textField, styles.notesField]}
              placeholder="Notes"
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              onFocus={() => onFieldFocus('notes')}
              multiline
              textAlignVertical="top"
            />
          </FormFieldSlot>

          <Pressable
            style={[styles.outlineButton, styles.outlineButtonFirst, submitting && styles.outlineButtonDisabled]}
            disabled={submitting}
            onPress={() => void save()}
          >
            {submitting ? (
              <ActivityIndicator color={brandBlue} />
            ) : (
              <Text style={styles.outlineButtonText}>DONE</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.outlineButton}
            disabled={submitting}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.outlineButtonText}>CANCEL</Text>
          </Pressable>
        </View>
      </ScrollView>

      {pickerTarget && (
        <DateTimePicker
          value={
            pickerTarget === 'time'
              ? puTime
              : pickerTarget === 'dropoffTime'
                ? dropoffTime
                : puDate
          }
          mode={pickerTarget === 'date' ? 'date' : 'time'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      )}
      {pickerTarget && Platform.OS === 'ios' && (
        <View style={styles.iosPickerBar}>
          <Pressable onPress={() => setPickerTarget(null)}>
            <Text style={styles.iosPickerDone}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

type EditReservationHeaderNavigation = {
  goBack(): void;
};

export function editReservationScreenOptions({
  navigation,
}: {
  navigation: EditReservationHeaderNavigation;
}) {
  return {
    headerShown: true,
    title: 'Edit Reservation',
    headerStyle: { backgroundColor: brandBlue },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' as const },
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerPressed]}
      >
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </Pressable>
    ),
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexGrow: 0,
  },
  formBody: {
    gap: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: { ...typography.body, color: '#C62828', textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, padding: spacing.md },
  retryBtnText: { color: brandBlue, fontWeight: '700' },
  textField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    marginBottom: spacing.sm,
    ...typography.body,
    color: '#111827',
  },
  readOnlyField: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  notesField: {
    minHeight: 120,
    paddingTop: spacing.md,
    backgroundColor: '#F9FAFB',
  },
  blueBarThree: {
    flexDirection: 'row',
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'stretch',
  },
  blueBarThird: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  barDividerLeft: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.75)',
  },
  timePrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeSecondary: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  passengerColumn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passengerStepBtn: {
    padding: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerStepPressed: { opacity: 0.75 },
  passengerCountLarge: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  locationBlueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  locationBlueTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  segmentGroup: { flexDirection: 'row', gap: spacing.xs },
  segment: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    minWidth: 84,
    alignItems: 'center',
  },
  segmentSelected: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  segmentTextSelected: { color: brandBlue },
  airportSplitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brandBlue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  airportSplitInput: {
    flex: 1,
    ...typography.body,
    color: '#FFFFFF',
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  airportSplitDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginHorizontal: spacing.xs,
  },
  darkerBarInput: {
    backgroundColor: darkerBlue,
    color: '#FFFFFF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...typography.body,
    fontWeight: '600',
  },
  airportTripleBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: brandBlue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tripleCell: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  tripleHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  tripleInput: {
    ...typography.body,
    color: '#FFFFFF',
    paddingVertical: 4,
  },
  tripleDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginVertical: spacing.xs,
  },
  tripleTime: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  tripleTimeSmall: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  airportFixedBar: {
    backgroundColor: darkerBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  airportFixedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  outlineButton: {
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md + 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  outlineButtonFirst: {
    marginTop: spacing.lg,
  },
  outlineButtonDisabled: { opacity: 0.7 },
  outlineButtonText: {
    color: brandBlue,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.8,
  },
  headerIconBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPressed: { opacity: 0.85 },
  iosPickerBar: {
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  iosPickerDone: {
    color: brandBlue,
    fontWeight: '700',
    fontSize: 17,
  },
});
