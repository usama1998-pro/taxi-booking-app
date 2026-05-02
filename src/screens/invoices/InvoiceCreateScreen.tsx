import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton, Screen, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { formatInvoiceMoney } from '../../lib/invoiceFormat';
import { downloadInvoicePdf } from '../../lib/invoicePdfDownload';
import { logger } from '../../lib/logger';
import type { InvoicesStackParamList } from '../../navigation/types';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { InvoiceAddressKind, InvoiceCreatePrefill } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

const TAX_RATE = 0.1;

function KindToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: InvoiceAddressKind;
  onChange: (v: InvoiceAddressKind) => void;
}) {
  return (
    <View style={styles.kindBlock}>
      <Text style={styles.kindLabel}>{label}</Text>
      <View style={styles.kindRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('LOCATION')}
          style={[styles.chip, value === 'LOCATION' && styles.chipOn]}
        >
          <Text style={[styles.chipText, value === 'LOCATION' && styles.chipTextOn]}>Location</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('AIRPORT')}
          style={[styles.chip, value === 'AIRPORT' && styles.chipOn]}
        >
          <Text style={[styles.chipText, value === 'AIRPORT' && styles.chipTextOn]}>Airport</Text>
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

/** Split e.g. "BA 117" or "LH441" into airline + flight number for airport pick-up. */
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
};

/**
 * Parses multi-line text from Booking detail “Copy all details” (label: value per line).
 */
function parsePastedBookingDetailsBlock(raw: string): ParsedBookingPaste | null {
  const t = raw.trimEnd();
  if (!/\r?\n/.test(t)) {
    return null;
  }
  const lower = t.toLowerCase();
  const looksLikeCopyAll =
    lower.includes('booking reference:') ||
    (lower.includes('name:') && (lower.includes('phone:') || lower.includes('trip date:')));
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
    }
  }
  if (
    out.bookingReference ||
    out.fullName ||
    out.phoneNumber ||
    out.pickupDateYmd ||
    out.pickupFlightNo
  ) {
    return out;
  }
  return null;
}

export function InvoiceCreateScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<InvoicesStackParamList>>();
  const route = useRoute<RouteProp<InvoicesStackParamList, 'InvoiceCreate'>>();
  const { accessToken } = useAuth();

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

  const priceNum = useMemo(() => {
    const n = Number.parseFloat(priceText.replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [priceText]);

  const taxAmount = priceNum * TAX_RATE;
  const totalAmount = priceNum + taxAmount;

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
      setBookingReference(parsed.bookingReference ?? '');
      return;
    }
    setBookingReference(text);
  }, []);

  const applyBookingPrice = async () => {
    if (!accessToken) {
      return;
    }
    const ref = bookingReference.trim();
    if (!ref) {
      setFormError('Enter the booking reference first, then load price.');
      return;
    }
    setFormError(null);
    setLoadingPrice(true);
    try {
      const { price } = await invoicesApi.suggestedPrice(accessToken, ref);
      setPriceText(String(price));
    } catch (e) {
      logger.warn('InvoiceCreate: suggested price failed', e);
      setFormError(e instanceof Error ? e.message : 'Could not load price.');
    } finally {
      setLoadingPrice(false);
    }
  };

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
    if (pickupKind === 'LOCATION' && !pickupAddress.trim()) {
      setFormError('Enter pick-up address for Location.');
      return;
    }
    if (pickupKind === 'AIRPORT' && !pickupFlightNo.trim()) {
      setFormError('Enter flight number for pick-up Airport (airline is optional).');
      return;
    }
    if (dropoffKind === 'LOCATION' && !dropoffAddress.trim()) {
      setFormError('Enter drop-off address for Location.');
      return;
    }
    if (dropoffKind === 'AIRPORT' && !dropoffFlightNo.trim()) {
      setFormError('Enter flight number for drop-off Airport (airline is optional).');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError('Enter a valid price greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
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
        priceAmount: priceNum,
      };
      const created = await invoicesApi.create(accessToken, body);
      try {
        const pdfMsg = await downloadInvoicePdf(accessToken, created.id);
        if (pdfMsg) {
          Alert.alert('PDF saved', pdfMsg);
        }
      } catch (e) {
        logger.warn('InvoiceCreate: PDF save failed', e);
        Alert.alert(
          'Invoice saved',
          'The PDF could not be saved. Open the invoice and use Download PDF to try again.',
        );
      }
      navigation.replace('InvoiceDetail', { id: created.id });
    } catch (e) {
      logger.warn('InvoiceCreate: submit failed', e);
      setFormError(e instanceof Error ? e.message : 'Could not create invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextField
          label="Booking reference"
          value={bookingReference}
          onChangeText={handleBookingReferenceChange}
          placeholder="Type, paste, or paste full “Copy all details” from a booking"
          multiline
          textAlignVertical="top"
          style={styles.bookingRefInput}
        />
        <Text style={styles.pasteHint}>
          Paste the whole block from a booking’s Copy all details to fill name, phone, trip date, and
          flight (pick-up switches to Airport when a flight line is present).
        </Text>
        <Pressable
          style={[styles.secondaryBtn, loadingPrice && styles.secondaryBtnDisabled]}
          onPress={() => void applyBookingPrice()}
          disabled={loadingPrice}
        >
          {loadingPrice ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.secondaryBtnText}>Load price from assigned booking</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Tax is 10% on the subtotal. Total is calculated when you save.
        </Text>

        <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <TextField
          label="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />

        {Platform.OS === 'web' ? (
          <TextField
            label="Pick-up date (YYYY-MM-DD)"
            value={pickupDateYmd}
            onChangeText={setPickupDateYmd}
            placeholder="2026-05-15"
          />
        ) : (
          <>
            <View style={styles.dateFieldWrap}>
              <Text style={styles.dateFieldLabel}>Pick-up date</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose pick-up date"
                onPress={() => {
                  const base = ymdToLocalDate(pickupDateYmd) ?? new Date();
                  setIosDateDraft(base);
                  if (Platform.OS === 'android') {
                    setShowAndroidDatePicker(true);
                  } else if (Platform.OS === 'ios') {
                    setShowIosDatePicker(true);
                  }
                }}
                style={({ pressed }) => [styles.dateFieldRow, pressed && styles.dateFieldRowPressed]}
              >
                <Text style={pickupDateYmd ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
                  {pickupDateYmd ? formatPickupDisplay(pickupDateYmd) : 'Tap to choose date'}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={colors.accent} />
              </Pressable>
            </View>

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
                        accessibilityLabel="Cancel date selection"
                        onPress={() => setShowIosDatePicker(false)}
                        hitSlop={12}
                      >
                        <Text style={styles.dateModalHeaderBtn}>Cancel</Text>
                      </Pressable>
                      <Text style={styles.dateModalTitle}>Pick-up date</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Confirm date"
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
          </>
        )}

        <KindToggle label="Pick-up" value={pickupKind} onChange={setPickupKind} />
        {pickupKind === 'LOCATION' ? (
          <TextField
            label="Pick-up address"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
          />
        ) : (
          <>
            <TextField label="Airline name (optional)" value={pickupAirline} onChangeText={setPickupAirline} />
            <TextField label="Flight number" value={pickupFlightNo} onChangeText={setPickupFlightNo} />
          </>
        )}

        <KindToggle label="Drop-off" value={dropoffKind} onChange={setDropoffKind} />
        {dropoffKind === 'LOCATION' ? (
          <TextField
            label="Drop-off address"
            value={dropoffAddress}
            onChangeText={setDropoffAddress}
            multiline
          />
        ) : (
          <>
            <TextField label="Airline name (optional)" value={dropoffAirline} onChangeText={setDropoffAirline} />
            <TextField label="Flight number" value={dropoffFlightNo} onChangeText={setDropoffFlightNo} />
          </>
        )}

        <Text style={styles.section}>Price</Text>
        <TextField
          label="Subtotal (GBP, editable)"
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <View style={styles.totalsCard}>
          <Text style={styles.totalLine}>Tax (10%): {formatInvoiceMoney(taxAmount)}</Text>
          <Text style={styles.totalStrong}>Total: {formatInvoiceMoney(totalAmount)}</Text>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <PrimaryButton
          label={submitting ? 'Saving…' : 'Generate invoice'}
          onPress={() => void submit()}
          disabled={submitting}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  pasteHint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  bookingRefInput: { minHeight: 56 },
  section: {
    ...typography.subtitle,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  kindBlock: { marginBottom: spacing.md },
  kindLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  chipText: { ...typography.body, color: colors.primaryMuted },
  chipTextOn: { color: colors.accent, fontWeight: '700' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryBtnDisabled: { opacity: 0.6 },
  secondaryBtnText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
  },
  totalsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  totalLine: { ...typography.body, color: colors.primaryMuted, marginBottom: spacing.xs },
  totalStrong: { ...typography.subtitle, color: colors.primary },
  formError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  dateFieldWrap: { marginBottom: spacing.md },
  dateFieldLabel: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  dateFieldRowPressed: { opacity: 0.92 },
  dateFieldValue: { ...typography.body, color: colors.primary, flex: 1 },
  dateFieldPlaceholder: { ...typography.body, color: colors.primaryMuted, flex: 1 },
  dateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dateModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  dateModalHeaderBtn: {
    ...typography.body,
    color: colors.primaryMuted,
    minWidth: 64,
  },
  dateModalHeaderBtnStrong: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 64,
  },
  iosInlinePicker: { alignSelf: 'center' },
});
