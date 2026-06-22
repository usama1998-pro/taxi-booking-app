import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { getDriverRootNavigation } from '../../navigation/getDriverRootNavigation';
import { getAppUiMessage } from '../../lib/apiErrors';
import {
  combineBookingDateAndTimeToIso,
} from '../../lib/pickupDateTime';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import { spacing, typography } from '../../theme';
import type { BookingsStackParamList } from '../../navigation/types';

const brandBlue = '#1E88E5';
const darkerBlue = '#1565C0';

/** Default airport name when Airport is selected. */
const FIXED_AIRPORT_LABEL = 'Barcelona-El Prat Airport';

/** Extra scroll space so fields stay above the keyboard (matches InvoiceCreate). */
const KEYBOARD_SCROLL_EXTRA_PAD = 280;

type LocationKind = 'location' | 'airport';

type PickerTarget = 'time' | 'date' | 'dropoffTime' | null;

function guestEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const core = digits.length > 0 ? digits : 'unknown';
  return `guest.${core}@taxibarcelona24.guest`;
}

function formatPuTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatPuDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildStreetLocation(detail: string): Record<string, unknown> {
  return {
    kind: 'location',
    label: detail.trim() || 'Address TBC',
  };
}

function buildAirportLocation(
  airportLabel: string,
  options?: { airline?: string; flight?: string; departureTime?: string },
): Record<string, unknown> {
  const loc: Record<string, unknown> = {
    kind: 'airport',
    label: airportLabel.trim() || FIXED_AIRPORT_LABEL,
  };
  const a = options?.airline?.trim();
  const f = options?.flight?.trim();
  const t = options?.departureTime?.trim();
  if (a) {
    loc.airline = a;
  }
  if (f) {
    loc.flight = f;
  }
  if (t) {
    loc.departureTime = t;
  }
  return loc;
}

type Nav = NativeStackNavigationProp<BookingsStackParamList, 'NewReservation'>;

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
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayout(fieldId, y, height);
      }}
    >
      {children}
    </View>
  );
}

export function NewReservationScreen() {
  const navigation = useNavigation<Nav>();
  const { user, ensureAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const fieldMetrics = useRef<Record<string, { y: number; height: number }>>({});
  const lastFocusedField = useRef<string | null>(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const keyboardOpen = keyboardBottomInset > 0;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [puTime, setPuTime] = useState(() => new Date());
  const [puDate, setPuDate] = useState(() => new Date());
  const [passengerCount, setPassengerCount] = useState(1);
  const [pickupKind, setPickupKind] = useState<LocationKind>('location');
  const [dropoffKind, setDropoffKind] = useState<LocationKind>('location');
  const [pickupDetail, setPickupDetail] = useState('');
  const [pickupAirportLabel, setPickupAirportLabel] = useState(FIXED_AIRPORT_LABEL);
  const [pickupAirline, setPickupAirline] = useState('');
  const [pickupFlight, setPickupFlight] = useState('');
  const [dropoffDetail, setDropoffDetail] = useState('');
  const [dropoffAirportLabel, setDropoffAirportLabel] = useState(FIXED_AIRPORT_LABEL);
  const [dropoffAirline, setDropoffAirline] = useState('');
  const [dropoffFlight, setDropoffFlight] = useState('');
  const [dropoffDepartureTime, setDropoffDepartureTime] = useState(() => new Date());
  const [notes, setNotes] = useState('');

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [submitting, setSubmitting] = useState(false);

  const goToBookingsList = useCallback(() => {
    const rootNav = getDriverRootNavigation(navigation);
    if (rootNav) {
      rootNav.navigate('Bookings', { screen: 'BookingsList' });
      return;
    }
    navigation.navigate('BookingsList');
  }, [navigation]);

  const scheduledIso = useMemo(
    () => combineBookingDateAndTimeToIso(puDate, puTime),
    [puDate, puTime],
  );

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
        setDropoffDepartureTime(selected);
      }
    },
    [pickerTarget],
  );

  const adjustPassengers = useCallback((delta: number) => {
    setPassengerCount((n) => Math.min(25, Math.max(1, n + delta)));
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
      if (keyboardOpen) {
        scrollFocusedFieldIntoView(id);
      }
    },
    [keyboardOpen, scrollFocusedFieldIntoView],
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

  const scrollBottomPad = useMemo(() => {
    const basePad = spacing.xxl + insets.bottom + spacing.xl;
    if (!keyboardOpen) {
      return basePad;
    }
    return basePad + KEYBOARD_SCROLL_EXTRA_PAD + keyboardBottomInset;
  }, [insets.bottom, keyboardBottomInset, keyboardOpen]);

  const submit = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Session', 'You need to be signed in as a driver to create a booking.');
      return;
    }
    const name = fullName.trim();
    const phoneTrim = phone.trim();
    if (!name || !phoneTrim) {
      Alert.alert('Required', 'Please enter full name and phone number.');
      return;
    }
    const pickupLocation: Record<string, unknown> =
      pickupKind === 'airport'
        ? buildAirportLocation(pickupAirportLabel, {
          airline: pickupAirline,
          flight: pickupFlight,
        })
        : buildStreetLocation(pickupDetail);

    const dropoffLocation: Record<string, unknown> =
      dropoffKind === 'airport'
        ? buildAirportLocation(dropoffAirportLabel, {
          airline: dropoffAirline,
          flight: dropoffFlight,
          departureTime: formatPuTime(dropoffDepartureTime),
        })
        : buildStreetLocation(dropoffDetail);

    const flightNumber =
      pickupKind === 'airport'
        ? [pickupAirline.trim(), pickupFlight.trim()].filter(Boolean).join(' ').trim() || undefined
        : undefined;

    const note = notes.trim() || undefined;

    const body: Record<string, unknown> = {
      driverId: user.id,
      pickupLocation,
      dropoffLocation,
      scheduledTime: scheduledIso,
      price: 0,
      status: 'PENDING',
      luggageCount: 0,
      passengerCount,
      customerName: name,
      customerPhone: phoneTrim,
      customerEmail: guestEmailFromPhone(phoneTrim),
      flightNumber,
      note,
    };
    const refTrim = bookingRef.trim();
    if (refTrim) {
      body.bookingReference = refTrim;
    }

    setSubmitting(true);
    try {
      const token = await ensureAccessToken();
      if (!token) {
        Alert.alert(
          'Session expired',
          'Please sign in again. If you tapped Done just before this, the booking may still have been saved.',
        );
        return;
      }
      await bookingsApi.create(body);
      goToBookingsList();
    } catch (e) {
      const msg = getAppUiMessage(e, 'Could not create booking. Please try again.');
      Alert.alert('Booking failed', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    ensureAccessToken,
    user?.id,
    fullName,
    phone,
    bookingRef,
    pickupDetail,
    pickupAirportLabel,
    pickupAirline,
    pickupFlight,
    dropoffDetail,
    dropoffAirportLabel,
    dropoffAirline,
    dropoffFlight,
    dropoffDepartureTime,
    pickupKind,
    dropoffKind,
    notes,
    passengerCount,
    scheduledIso,
    goToBookingsList,
    navigation,
  ]);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
              autoCapitalize="words"
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
          <FormFieldSlot fieldId="bookingRef" onLayout={onFieldLayout}>
            <TextInput
              style={styles.textField}
              placeholder="Booking Reference"
              placeholderTextColor="#9CA3AF"
              value={bookingRef}
              onChangeText={setBookingRef}
              onFocus={() => onFieldFocus('bookingRef')}
              autoCapitalize="characters"
            />
          </FormFieldSlot>

          <View style={styles.blueBarThree}>
            <Pressable style={styles.blueBarThird} onPress={() => setPickerTarget('time')}>
              <Text style={styles.blueBarLabel}>PU TIME</Text>
              <View style={styles.blueBarUnderline} />
              <Text style={styles.blueBarValue}>{formatPuTime(puTime)}</Text>
            </Pressable>
            <Pressable style={styles.blueBarThird} onPress={() => setPickerTarget('date')}>
              <Text style={styles.blueBarLabel}>PU DATE</Text>
              <View style={styles.blueBarUnderline} />
              <Text style={styles.blueBarValue}>{formatPuDate(puDate)}</Text>
            </Pressable>
            <View style={[styles.blueBarThird, styles.blueBarThirdLast, styles.passengerColumn]}>
              <Text style={styles.blueBarLabel}>PASSENGER</Text>
              <View style={styles.blueBarUnderline} />
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
                    size={24}
                    color={passengerCount <= 1 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                  />
                </Pressable>
                <Text style={styles.passengerCountText}>{passengerCount}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase passengers"
                  accessibilityState={{ disabled: passengerCount >= 25 }}
                  disabled={passengerCount >= 25}
                  hitSlop={8}
                  onPress={() => adjustPassengers(1)}
                  style={({ pressed }) => [
                    styles.passengerStepBtn,
                    pressed && passengerCount < 25 && styles.passengerStepPressed,
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={passengerCount >= 25 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.locationBlueBar}>
            <Text style={styles.locationBlueTitle}>PICK UP</Text>
            <View style={styles.segmentGroup}>
              <Pressable
                onPress={() => setPickupKind('location')}
                style={[styles.segment, pickupKind === 'location' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, pickupKind === 'location' && styles.segmentTextSelected]}>
                  Location
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPickupKind('airport');
                  setPickupAirportLabel((v) => v.trim() || FIXED_AIRPORT_LABEL);
                }}
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
                placeholder="Street / area (optional)"
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
            </>
          )}

          <View style={styles.locationBlueBar}>
            <Text style={styles.locationBlueTitle}>DROP OFF</Text>
            <View style={styles.segmentGroup}>
              <Pressable
                onPress={() => setDropoffKind('location')}
                style={[styles.segment, dropoffKind === 'location' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, dropoffKind === 'location' && styles.segmentTextSelected]}>
                  Location
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDropoffKind('airport');
                  setDropoffAirportLabel((v) => v.trim() || FIXED_AIRPORT_LABEL);
                }}
                style={[styles.segment, dropoffKind === 'airport' && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, dropoffKind === 'airport' && styles.segmentTextSelected]}>
                  Airport
                </Text>
              </Pressable>
            </View>
          </View>
          {dropoffKind === 'location' ? (
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
                <View style={styles.airportSplitBar}>
                  <TextInput
                    style={styles.airportSplitInput}
                    placeholder="Airline (optional)"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    value={dropoffAirline}
                    onChangeText={setDropoffAirline}
                    onFocus={() => onFieldFocus('dropoffAirline')}
                    autoCapitalize="characters"
                  />
                  <View style={styles.airportSplitDivider} />
                  <TextInput
                    style={styles.airportSplitInput}
                    placeholder="Flight (optional)"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    value={dropoffFlight}
                    onChangeText={setDropoffFlight}
                    onFocus={() => onFieldFocus('dropoffAirline')}
                    autoCapitalize="characters"
                  />
                  <View style={styles.airportSplitDivider} />
                  <Pressable
                    style={styles.airportTimeCell}
                    onPress={() => setPickerTarget('dropoffTime')}
                  >
                    <Text style={styles.airportTimeHint}>Time</Text>
                    <Text style={styles.airportTimeValue}>{formatPuTime(dropoffDepartureTime)}</Text>
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
              numberOfLines={2}
              textAlignVertical="top"
            />
          </FormFieldSlot>

          <Pressable
            style={[styles.doneButton, submitting && styles.doneButtonDisabled]}
            disabled={submitting}
            onPress={() => void submit()}
          >
            {submitting ? (
              <ActivityIndicator color={brandBlue} />
            ) : (
              <Text style={styles.doneButtonText}>DONE</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {pickerTarget && (
        <DateTimePicker
          value={
            pickerTarget === 'time'
              ? puTime
              : pickerTarget === 'dropoffTime'
                ? dropoffDepartureTime
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

export function newReservationScreenOptions({ navigation }: { navigation: Nav }) {
  return {
    headerShown: true,
    title: 'New Reservation',
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
    headerRight: () => <NewReservationSignOutButton />,
  };
}

function NewReservationSignOutButton() {
  const { signOut, isSigningOut } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSigningOut ? 'Signing out' : 'Sign out'}
      disabled={isSigningOut}
      hitSlop={12}
      onPress={() => void signOut()}
      style={({ pressed }) => [
        styles.headerIconBtn,
        pressed && !isSigningOut && styles.headerPressed,
        isSigningOut && styles.headerDisabled,
      ]}
    >
      <Ionicons name="power-outline" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

const formFont = {
  field: 19,
  notes: 19,
  barLabel: 13,
  barValue: 18,
  sectionTitle: 18,
  segment: 16,
  airportInput: 18,
  done: 18,
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    flexGrow: 0,
  },
  formBody: {
    gap: 0,
  },
  textField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
    ...typography.body,
    fontSize: formFont.field,
    lineHeight: 22,
    color: '#111827',
  },
  notesField: {
    fontSize: formFont.notes,
    lineHeight: 22,
    minHeight: 48,
    maxHeight: 56,
    paddingTop: 10,
    marginBottom: 0,
  },
  blueBarThree: {
    flexDirection: 'row',
    backgroundColor: brandBlue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  blueBarThird: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  blueBarThirdLast: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.6)',
  },
  passengerColumn: {
    justifyContent: 'flex-start',
  },
  passengerStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  passengerStepBtn: {
    padding: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerStepPressed: {
    opacity: 0.75,
  },
  passengerCountText: {
    color: '#FFFFFF',
    fontSize: formFont.barValue,
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'center',
  },
  blueBarLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: formFont.barLabel,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  blueBarUnderline: {
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  blueBarValue: {
    color: '#FFFFFF',
    fontSize: formFont.barValue,
    fontWeight: '600',
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
    fontSize: formFont.sectionTitle,
    letterSpacing: 0.4,
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    minWidth: 92,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: formFont.segment,
  },
  segmentTextSelected: {
    color: brandBlue,
  },
  airportSplitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  airportSplitInput: {
    flex: 1,
    ...typography.body,
    fontSize: formFont.airportInput,
    lineHeight: 22,
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
  airportTimeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  airportTimeHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: formFont.barLabel,
    fontWeight: '700',
    marginBottom: 2,
  },
  airportTimeValue: {
    color: '#FFFFFF',
    fontSize: formFont.airportInput,
    fontWeight: '700',
  },
  darkerBarInput: {
    backgroundColor: darkerBlue,
    color: '#FFFFFF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...typography.body,
    fontSize: formFont.airportInput,
    lineHeight: 24,
    fontWeight: '600',
  },
  doneButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md + 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.7,
  },
  doneButtonText: {
    color: brandBlue,
    fontWeight: '800',
    fontSize: formFont.done,
    letterSpacing: 0.8,
  },
  headerIconBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPressed: {
    opacity: 0.85,
  },
  headerDisabled: {
    opacity: 0.45,
  },
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
