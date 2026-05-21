import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { formatInvoiceMoney } from '../../lib/invoiceFormat';
import { downloadInvoicePdf } from '../../lib/invoicePdfDownload';
import { getAppUiMessage } from '../../lib/apiErrors';
import { logger } from '../../lib/logger';
import { HeaderSignOutButton } from '../../navigation/driverChrome';
import type { InvoicesStackParamList } from '../../navigation/types';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { InvoiceAddressKind, InvoiceCreatePrefill } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

const TAX_RATE = 0.1;
/** Matches other driver chrome (home / bookings / reservations). */
const brandBlue = '#1E88E5';

function LocationAirportBar({
  title,
  value,
  onChange,
}: {
  title: string;
  value: InvoiceAddressKind;
  onChange: (v: InvoiceAddressKind) => void;
}) {
  return (
    <View style={styles.locBar}>
      <Text style={styles.locBarTitle}>{title}</Text>
      <View style={styles.segmentGroup}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('LOCATION')}
          style={[styles.segment, value === 'LOCATION' && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, value === 'LOCATION' && styles.segmentTextSelected]}>Location</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('AIRPORT')}
          style={[styles.segment, value === 'AIRPORT' && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, value === 'AIRPORT' && styles.segmentTextSelected]}>Airport</Text>
        </Pressable>
      </View>
    </View>
  );
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdToLocalDate(ymd: string): Date | null {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const [y, mo, d] = t.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(y, mo - 1, d);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

function formatPickupDisplay(ymd: string): string {
  const d = ymdToLocalDate(ymd);
  if (!d) {
    return ymd;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return ymd;
  }
}

function parsePickupDate(dateYmd: string): string | null {
  const d = ymdToLocalDate(dateYmd);
  if (!d) {
    return null;
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0).toISOString();
}

function splitFlightPasted(val: string): { airline: string; flightNo: string } {
  const v = val.trim();
  const m = /^([A-Za-z]{2,3})[\s-]*(\d{1,4}[A-Za-z]?)$/.exec(v);
  if (m) {
    return { airline: m[1].toUpperCase(), flightNo: m[2] };
  }
  return { airline: '', flightNo: v };
}

type ParsedBookingPaste = {
  bookingReference?: string;
  fullName?: string;
  phoneNumber?: string;
  pickupDateYmd?: string;
  pickupAirline?: string;
  pickupFlightNo?: string;
  useAirportPickup?: boolean;
  childSeatsSummary?: string;
};

function parsePastedBookingDetailsBlock(raw: string): ParsedBookingPaste | null {
  const t = raw.trimEnd();
  if (!/\r?\n/.test(t)) {
    return null;
  }
  const lower = t.toLowerCase();
  const looksLikeCopyAll =
    lower.includes('booking reference:') ||
    (lower.includes('name:') && (lower.includes('phone:') || lower.includes('trip date:'))) ||
    lower.includes('child seats:');
  if (!looksLikeCopyAll) {
    return null;
  }
  const out: ParsedBookingPaste = {};
  for (const line of t.split(/\r?\n/)) {
    const trimmed = line.trim();
    const m = /^([^:]+):\s*(.*)$/.exec(trimmed);
    if (!m) {
      continue;
    }
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (!val) {
      continue;
    }
    if (key === 'name') {
      out.fullName = val;
    } else if (key === 'phone') {
      out.phoneNumber = val;
    } else if (key === 'flight') {
      const sp = splitFlightPasted(val);
      out.pickupFlightNo = sp.flightNo;
      out.pickupAirline = sp.airline;
      out.useAirportPickup = true;
    } else if (key === 'booking reference') {
      out.bookingReference = val;
    } else if (key === 'trip date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(val) && ymdToLocalDate(val)) {
        out.pickupDateYmd = val;
      }
    } else if (key === 'child seats') {
      out.childSeatsSummary = val;
    }
  }
  if (
    out.bookingReference ||
    out.fullName ||
    out.phoneNumber ||
    out.pickupDateYmd ||
    out.pickupFlightNo ||
    out.childSeatsSummary
  ) {
    return out;
  }
  return null;
}

type InvoiceCreateNav = NativeStackNavigationProp<InvoicesStackParamList, 'InvoiceCreate'>;

const KEYBOARD_SCROLL_EXTRA_PAD = 280;

export function InvoiceCreateScreen() {
  const navigation = useNavigation<InvoiceCreateNav>();
  const route = useRoute<RouteProp<InvoicesStackParamList, 'InvoiceCreate'>>();
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [pickupDateYmd, setPickupDateYmd] = useState('');
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const [iosDateDraft, setIosDateDraft] = useState(() => new Date());

  const [pickupKind, setPickupKind] = useState<InvoiceAddressKind>('LOCATION');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupAirline, setPickupAirline] = useState('');
  const [pickupFlightNo, setPickupFlightNo] = useState('');

  const [dropoffKind, setDropoffKind] = useState<InvoiceAddressKind>('LOCATION');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffAirline, setDropoffAirline] = useState('');
  const [dropoffFlightNo, setDropoffFlightNo] = useState('');

  const [priceText, setPriceText] = useState('');
  const [childSeatsSummary, setChildSeatsSummary] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const applyPrefill = useCallback((p: InvoiceCreatePrefill) => {
    setFormError(null);
    setFullName(p.fullName);
    setPhoneNumber(p.phoneNumber);
    setBookingReference(p.bookingReference);
    setPickupDateYmd(p.pickupDateYmd);
    setPriceText(p.priceText);
    setPickupKind(p.pickupKind);
    setPickupAddress(p.pickupAddress ?? '');
    setPickupAirline(p.pickupAirline ?? '');
    setPickupFlightNo(p.pickupFlightNo ?? '');
    setDropoffKind(p.dropoffKind);
    setDropoffAddress(p.dropoffAddress ?? '');
    setDropoffAirline(p.dropoffAirline ?? '');
    setDropoffFlightNo(p.dropoffFlightNo ?? '');
    setChildSeatsSummary(p.childSeatsSummary ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      const prefill = route.params?.prefill;
      if (!prefill) {
        return;
      }
      applyPrefill(prefill);
      navigation.setParams({ prefill: undefined });
    }, [route.params, applyPrefill, navigation]),
  );

  const priceNum = Number.parseFloat(priceText.replace(/,/g, ''));
  const priceValid = Number.isFinite(priceNum) && priceNum >= 0;
  const subtotal = priceValid ? priceNum : 0;
  const deductionAmount = subtotal * TAX_RATE;
  const totalAmount = subtotal - deductionAmount;

  const handleBookingReferenceChange = useCallback((text: string) => {
    const parsed = parsePastedBookingDetailsBlock(text);
    if (parsed) {
      setFormError(null);
      if (parsed.fullName) {
        setFullName(parsed.fullName);
      }
      if (parsed.phoneNumber) {
        setPhoneNumber(parsed.phoneNumber);
      }
      if (parsed.pickupDateYmd) {
        setPickupDateYmd(parsed.pickupDateYmd);
      }
      if (parsed.useAirportPickup && (parsed.pickupFlightNo || parsed.pickupAirline)) {
        setPickupKind('AIRPORT');
        if (parsed.pickupAirline) {
          setPickupAirline(parsed.pickupAirline);
        }
        if (parsed.pickupFlightNo) {
          setPickupFlightNo(parsed.pickupFlightNo);
        }
      }
      if (parsed.childSeatsSummary) {
        setChildSeatsSummary(parsed.childSeatsSummary);
      }
      setBookingReference(parsed.bookingReference ?? '');
      return;
    }
    setBookingReference(text);
  }, []);

  const tryLoadSuggestedPrice = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const ref = bookingReference.trim();
    if (!ref) {
      return;
    }
    setLoadingPrice(true);
    try {
      const { price } = await invoicesApi.suggestedPrice(accessToken, ref);
      setPriceText(String(price));
      setFormError(null);
    } catch {
      /* optional: booking may not be linked */
    } finally {
      setLoadingPrice(false);
    }
  }, [accessToken, bookingReference]);

  const openDatePicker = useCallback(() => {
    const base = ymdToLocalDate(pickupDateYmd) ?? new Date();
    setIosDateDraft(base);
    if (Platform.OS === 'android') {
      setShowAndroidDatePicker(true);
    } else if (Platform.OS === 'ios') {
      setShowIosDatePicker(true);
    }
  }, [pickupDateYmd]);

  const submit = async () => {
    setFormError(null);
    if (!accessToken) {
      setFormError('Not signed in.');
      return;
    }
    const pickupIso = parsePickupDate(pickupDateYmd);
    if (!pickupIso) {
      setFormError('Choose a pick-up date.');
      return;
    }
    if (!fullName.trim() || !phoneNumber.trim() || !bookingReference.trim()) {
      setFormError('Name, phone, and booking reference are required.');
      return;
    }
    if (!priceValid || subtotal <= 0) {
      setFormError('Enter a valid price greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const cs = childSeatsSummary.trim();
      const body = {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        bookingReference: bookingReference.trim(),
        pickupDate: pickupIso,
        pickupKind,
        pickupAddress: pickupKind === 'LOCATION' ? pickupAddress.trim() : undefined,
        pickupAirline: pickupKind === 'AIRPORT' ? pickupAirline.trim() : undefined,
        pickupFlightNo: pickupKind === 'AIRPORT' ? pickupFlightNo.trim() : undefined,
        dropoffKind,
        dropoffAddress: dropoffKind === 'LOCATION' ? dropoffAddress.trim() : undefined,
        dropoffAirline: dropoffKind === 'AIRPORT' ? dropoffAirline.trim() : undefined,
        dropoffFlightNo: dropoffKind === 'AIRPORT' ? dropoffFlightNo.trim() : undefined,
        priceAmount: subtotal,
        ...(cs ? { childSeatsSummary: cs } : {}),
      };
      const created = await invoicesApi.create(accessToken, body);
      let message = 'Your invoice was generated successfully.';
      try {
        const pdfMsg = await downloadInvoicePdf(accessToken, created.id);
        if (pdfMsg) {
          message = `${message}\n\n${pdfMsg}`;
        }
      } catch (e) {
        logger.warn('InvoiceCreate: PDF save failed', e);
        message = `${message}\n\nPDF could not be saved to this device. You can download it from the invoices list.`;
      }
      Alert.alert('Success', message);
    } catch (e) {
      logger.warn('InvoiceCreate: submit failed', e);
      setFormError(getAppUiMessage(e, 'Could not create invoice. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = styles.textField;
  const scrollBottomPad = spacing.xxl + insets.bottom + KEYBOARD_SCROLL_EXTRA_PAD;

  return (
    <Screen style={styles.screenRoot}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        <TextInput
          style={fieldStyle}
          placeholder="Full Name"
          placeholderTextColor="#B0BEC5"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
        <TextInput
          style={fieldStyle}
          placeholder="Phone Number"
          placeholderTextColor="#B0BEC5"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
        <View>
          <TextInput
            style={[fieldStyle, styles.bookingRefInput]}
            placeholder="Booking Reference"
            placeholderTextColor="#B0BEC5"
            value={bookingReference}
            onChangeText={handleBookingReferenceChange}
            onEndEditing={() => void tryLoadSuggestedPrice()}
            multiline
            autoCapitalize="characters"
          />
          {loadingPrice ? (
            <View style={styles.priceHintRow}>
              <ActivityIndicator size="small" color={brandBlue} />
              <Text style={styles.priceHint}>Checking booking price…</Text>
            </View>
          ) : null}
        </View>

        {Platform.OS === 'web' ? (
          <TextInput
            style={fieldStyle}
            placeholder="PU date (YYYY-MM-DD)"
            placeholderTextColor="#B0BEC5"
            value={pickupDateYmd}
            onChangeText={setPickupDateYmd}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose pick-up date"
            onPress={openDatePicker}
            style={styles.puDateBlock}
          >
            <View style={styles.puDateTop}>
              <Text style={styles.puDateLabel}>PU DATE</Text>
              <View style={styles.puDateUnderline} />
            </View>
            <View style={styles.puDateBottom}>
              <Text style={pickupDateYmd ? styles.puDateValue : styles.puDatePlaceholder}>
                {pickupDateYmd ? formatPickupDisplay(pickupDateYmd) : 'Tap to choose date'}
              </Text>
            </View>
          </Pressable>
        )}

        {Platform.OS === 'android' && showAndroidDatePicker ? (
          <DateTimePicker
            value={ymdToLocalDate(pickupDateYmd) ?? new Date()}
            mode="date"
            display="calendar"
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              setShowAndroidDatePicker(false);
              if (event.type === 'set' && date) {
                setPickupDateYmd(toYmd(date));
              }
            }}
          />
        ) : null}

        {Platform.OS === 'ios' ? (
          <Modal
            visible={showIosDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowIosDatePicker(false)}
          >
            <View style={styles.dateModalOverlay}>
              <Pressable style={styles.dateModalBackdrop} onPress={() => setShowIosDatePicker(false)} />
              <View style={styles.dateModalSheet}>
                <View style={styles.dateModalHeader}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowIosDatePicker(false)}
                    hitSlop={12}
                  >
                    <Text style={styles.dateModalHeaderBtn}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.dateModalTitle}>PU DATE</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setPickupDateYmd(toYmd(iosDateDraft));
                      setShowIosDatePicker(false);
                    }}
                    hitSlop={12}
                  >
                    <Text style={styles.dateModalHeaderBtnStrong}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={iosDateDraft}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  onChange={(_event: DateTimePickerEvent, date?: Date) => {
                    if (date) {
                      setIosDateDraft(date);
                    }
                  }}
                  style={styles.iosInlinePicker}
                />
              </View>
            </View>
          </Modal>
        ) : null}

        <LocationAirportBar title="PICK UP" value={pickupKind} onChange={setPickupKind} />
        {pickupKind === 'LOCATION' ? (
          <TextInput
            style={fieldStyle}
            placeholder="Pick-up address"
            placeholderTextColor="#B0BEC5"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
          />
        ) : (
          <View style={styles.airportFields}>
            <TextInput
              style={fieldStyle}
              placeholder="Airline (optional)"
              placeholderTextColor="#B0BEC5"
              value={pickupAirline}
              onChangeText={setPickupAirline}
            />
            <TextInput
              style={fieldStyle}
              placeholder="Flight number"
              placeholderTextColor="#B0BEC5"
              value={pickupFlightNo}
              onChangeText={setPickupFlightNo}
            />
          </View>
        )}

        <LocationAirportBar title="DROP OFF" value={dropoffKind} onChange={setDropoffKind} />
        {dropoffKind === 'LOCATION' ? (
          <TextInput
            style={fieldStyle}
            placeholder="Drop-off address (optional)"
            placeholderTextColor="#B0BEC5"
            value={dropoffAddress}
            onChangeText={setDropoffAddress}
            multiline
          />
        ) : (
          <View style={styles.airportFields}>
            <TextInput
              style={fieldStyle}
              placeholder="Airline (optional)"
              placeholderTextColor="#B0BEC5"
              value={dropoffAirline}
              onChangeText={setDropoffAirline}
            />
            <TextInput
              style={fieldStyle}
              placeholder="Flight number (optional)"
              placeholderTextColor="#B0BEC5"
              value={dropoffFlightNo}
              onChangeText={setDropoffFlightNo}
            />
          </View>
        )}

        <TextInput
          style={fieldStyle}
          placeholder="Price"
          placeholderTextColor="#B0BEC5"
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
        />
        <View style={[fieldStyle, styles.readonlyBox]}>
          <Text style={subtotal > 0 ? styles.readonlyValue : styles.readonlyPlaceholder}>
            {subtotal > 0 ? formatInvoiceMoney(deductionAmount) : '10% tax'}
          </Text>
        </View>
        <View style={[fieldStyle, styles.readonlyBox]}>
          <Text style={subtotal > 0 ? styles.readonlyValue : styles.readonlyPlaceholder}>
            {subtotal > 0 ? formatInvoiceMoney(totalAmount) : 'Remaining'}
          </Text>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Pressable
          style={[styles.doneButton, submitting && styles.doneDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? (
            <ActivityIndicator color={brandBlue} />
          ) : (
            <Text style={styles.doneText}>DONE</Text>
          )}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type InvoiceCreateHeaderNav = {
  goBack(): void;
};

export function invoiceCreateScreenOptions({ navigation }: { navigation: InvoiceCreateHeaderNav }) {
  return {
    headerShown: true,
    title: 'Generate Invoice',
    headerStyle: { backgroundColor: brandBlue },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' as const, fontSize: 18 },
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
    headerRight: () => <HeaderSignOutButton />,
  };
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  kav: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  textField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CFD8DC',
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    marginBottom: spacing.sm,
    ...typography.body,
    color: '#212121',
    backgroundColor: '#FFFFFF',
  },
  bookingRefInput: { minHeight: 44, maxHeight: 100, textAlignVertical: 'top' },
  priceHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  priceHint: { ...typography.caption, color: colors.primaryMuted },
  puDateBlock: {
    backgroundColor: brandBlue,
    marginBottom: spacing.sm,
    borderRadius: 0,
    overflow: 'hidden',
  },
  puDateTop: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
  puDateLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  puDateUnderline: {
    height: 2,
    backgroundColor: '#FFFFFF',
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    marginHorizontal: spacing.lg,
  },
  puDateBottom: {
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  puDateValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  puDatePlaceholder: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '600',
  },
  locBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brandBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  locBarTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
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
  airportFields: { marginBottom: spacing.xs },
  readonlyBox: {
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  readonlyValue: {
    ...typography.body,
    color: '#78909C',
    fontWeight: '600',
  },
  readonlyPlaceholder: {
    ...typography.body,
    color: '#B0BEC5',
  },
  formError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  doneButton: {
    marginTop: spacing.lg,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md + 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  doneDisabled: { opacity: 0.7 },
  doneText: {
    color: brandBlue,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.8,
  },
  headerIconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPressed: { opacity: 0.85 },
  dateModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dateModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateModalTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  dateModalHeaderBtn: { ...typography.body, color: colors.primaryMuted, minWidth: 64 },
  dateModalHeaderBtnStrong: {
    ...typography.body,
    color: brandBlue,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 64,
  },
  iosInlinePicker: { alignSelf: 'center' },
});
