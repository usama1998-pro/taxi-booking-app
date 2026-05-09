import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { getDriverRootNavigation } from '../../navigation/getDriverRootNavigation';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import { spacing, typography } from '../../theme';
import type { BookingsStackParamList } from '../../navigation/types';

const brandBlue = '#1E88E5';

/** Fixed airport name when Location / Airport toggle is Airport (per product UI). */
const FIXED_AIRPORT_LABEL = 'Barcelona-El Prat Airport';

type LocationKind = 'location' | 'airport';

type PickerTarget = 'time' | 'date' | null;

function guestEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const core = digits.length > 0 ? digits : 'unknown';
  return `guest.${core}@taxibarcelona24.guest`;
}

function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const next = new Date(datePart);
  next.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return next;
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

function buildFixedAirportLocation(): Record<string, unknown> {
  return { kind: 'airport', label: FIXED_AIRPORT_LABEL };
}

function buildPickupAirportLocation(airline: string, flight: string): Record<string, unknown> {
  const a = airline.trim();
  const f = flight.trim();
  const loc: Record<string, unknown> = {
    kind: 'airport',
    label: FIXED_AIRPORT_LABEL,
  };
  if (a) {
    loc.airline = a;
  }
  if (f) {
    loc.flight = f;
  }
  return loc;
}

type Nav = NativeStackNavigationProp<BookingsStackParamList, 'NewReservation'>;

export function NewReservationScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [puTime, setPuTime] = useState(() => new Date());
  const [puDate, setPuDate] = useState(() => new Date());
  const [passengerCount, setPassengerCount] = useState(1);
  const [pickupKind, setPickupKind] = useState<LocationKind>('location');
  const [dropoffKind, setDropoffKind] = useState<LocationKind>('location');
  const [pickupDetail, setPickupDetail] = useState('');
  const [pickupAirline, setPickupAirline] = useState('');
  const [pickupFlight, setPickupFlight] = useState('');
  const [dropoffDetail, setDropoffDetail] = useState('');
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
    () => combineDateAndTime(puDate, puTime).toISOString(),
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
      }
    },
    [pickerTarget],
  );

  const adjustPassengers = useCallback((delta: number) => {
    setPassengerCount((n) => Math.min(8, Math.max(1, n + delta)));
  }, []);

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
        ? buildPickupAirportLocation(pickupAirline, pickupFlight)
        : buildStreetLocation(pickupDetail);

    const dropoffLocation: Record<string, unknown> =
      dropoffKind === 'airport' ? buildFixedAirportLocation() : buildStreetLocation(dropoffDetail);

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
      await bookingsApi.create(body);
      goToBookingsList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create booking';
      Alert.alert('Booking failed', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    user?.id,
    fullName,
    phone,
    bookingRef,
    pickupDetail,
    pickupAirline,
    pickupFlight,
    dropoffDetail,
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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={styles.textField}
          placeholder="Full Name"
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.textField}
          placeholder="Phone Number"
          placeholderTextColor="#9CA3AF"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.textField}
          placeholder="Booking Reference"
          placeholderTextColor="#9CA3AF"
          value={bookingRef}
          onChangeText={setBookingRef}
          autoCapitalize="characters"
        />

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
                  size={22}
                  color={passengerCount <= 1 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                />
              </Pressable>
              <Text style={styles.passengerCountText}>{passengerCount}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase passengers"
                accessibilityState={{ disabled: passengerCount >= 8 }}
                disabled={passengerCount >= 8}
                hitSlop={8}
                onPress={() => adjustPassengers(1)}
                style={({ pressed }) => [
                  styles.passengerStepBtn,
                  pressed && passengerCount < 8 && styles.passengerStepPressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={passengerCount >= 8 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
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
              onPress={() => setPickupKind('airport')}
              style={[styles.segment, pickupKind === 'airport' && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, pickupKind === 'airport' && styles.segmentTextSelected]}>
                Airport
              </Text>
            </Pressable>
          </View>
        </View>
        {pickupKind === 'location' ? (
          <TextInput
            style={styles.textField}
            placeholder="Street / area (optional)"
            placeholderTextColor="#9CA3AF"
            value={pickupDetail}
            onChangeText={setPickupDetail}
          />
        ) : (
          <>
            <View style={styles.airportSplitBar}>
              <TextInput
                style={styles.airportSplitInput}
                placeholder="Airline (optional)"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={pickupAirline}
                onChangeText={setPickupAirline}
                autoCapitalize="characters"
              />
              <View style={styles.airportSplitDivider} />
              <TextInput
                style={styles.airportSplitInput}
                placeholder="Flight (optional)"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={pickupFlight}
                onChangeText={setPickupFlight}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.airportFixedBar}>
              <Text style={styles.airportFixedText}>{FIXED_AIRPORT_LABEL}</Text>
            </View>
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
              onPress={() => setDropoffKind('airport')}
              style={[styles.segment, dropoffKind === 'airport' && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, dropoffKind === 'airport' && styles.segmentTextSelected]}>
                Airport
              </Text>
            </Pressable>
          </View>
        </View>
        {dropoffKind === 'location' ? (
          <TextInput
            style={styles.textField}
            placeholder="Street / area (optional)"
            placeholderTextColor="#9CA3AF"
            value={dropoffDetail}
            onChangeText={setDropoffDetail}
          />
        ) : (
          <View style={styles.airportFixedBar}>
            <Text style={styles.airportFixedText}>{FIXED_AIRPORT_LABEL}</Text>
          </View>
        )}

        <TextInput
          style={[styles.textField, styles.notesField]}
          placeholder="Notes"
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

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
      </ScrollView>

      {pickerTarget && (
        <DateTimePicker
          value={pickerTarget === 'time' ? puTime : puDate}
          mode={pickerTarget === 'time' ? 'time' : 'date'}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
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
  notesField: {
    minHeight: 120,
    paddingTop: spacing.md,
  },
  blueBarThree: {
    flexDirection: 'row',
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
    fontSize: 17,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
  },
  blueBarLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  blueBarUnderline: {
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    marginBottom: 6,
    alignSelf: 'stretch',
  },
  blueBarValue: {
    color: '#FFFFFF',
    fontSize: 15,
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
    fontSize: 15,
    letterSpacing: 0.4,
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    minWidth: 84,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  segmentTextSelected: {
    color: brandBlue,
  },
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
  airportFixedBar: {
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  airportFixedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: spacing.lg,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md + 4,
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
    fontSize: 16,
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
