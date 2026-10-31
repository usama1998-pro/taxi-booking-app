import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PricingPasscodeGate, PrimaryButton, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { getAppUiMessage } from '../../lib/apiErrors';
import { HeaderSignOutButton } from '../../navigation/driverChrome';
import { pricingApi } from '../../services/pricing/pricingApi';
import type { PassengerLuggageTier, PricingSettingsValues } from '../../types/pricing';
import { colors, spacing, typography } from '../../theme';

const brandBlue = '#1E88E5';
/** Extra scroll room so the last price fields sit above the keyboard. */
const KEYBOARD_SCROLL_EXTRA_PAD = 240;

type ScalarKey = Exclude<keyof PricingSettingsValues, 'passengerLuggageTiers'>;

type FormValues = {
  [K in ScalarKey]: string;
} & {
  passengerLuggageTiers: Array<{
    passengers: string;
    luggage: string;
    price: string;
  }>;
};

type FieldDef = {
  section: 'distance' | 'seats';
  key: ScalarKey;
  label: string;
  hint: string;
};

const DEFAULT_TIERS: PassengerLuggageTier[] = [
  { passengers: 1, luggage: 1, price: 52 },
  { passengers: 2, luggage: 2, price: 52 },
  { passengers: 3, luggage: 3, price: 57 },
  { passengers: 4, luggage: 4, price: 62 },
  { passengers: 5, luggage: 5, price: 72 },
  { passengers: 6, luggage: 6, price: 77 },
  { passengers: 7, luggage: 7, price: 84 },
  { passengers: 8, luggage: 8, price: 110 },
  { passengers: 8, luggage: 12, price: 127 },
  { passengers: 8, luggage: 16, price: 153 },
];

const MIN_TIERS = DEFAULT_TIERS.length;

const DEFAULT_TIER_PRICE_BY_KEY = new Map(
  DEFAULT_TIERS.map((t) => [`${t.passengers}:${t.luggage}`, t.price] as const),
);

function defaultTierMinPrice(passengers: number, luggage: number): number | null {
  const value = DEFAULT_TIER_PRICE_BY_KEY.get(`${passengers}:${luggage}`);
  return value == null ? null : value;
}

const FIELDS: FieldDef[] = [
  {
    section: 'distance',
    key: 'shortTripMaxKm',
    label: 'Short-trip max (km)',
    hint: 'No distance surcharge below this distance.',
  },
  {
    section: 'distance',
    key: 'midMaxKm',
    label: 'Mid-range max (km)',
    hint: 'Upper bound for the mid-range per-km rate.',
  },
  {
    section: 'distance',
    key: 'midRateEurPerKm',
    label: 'Mid-range rate (€/km)',
    hint: 'Charged when distance is between short-trip max and mid-range max.',
  },
  {
    section: 'distance',
    key: 'longRateEurPerKm',
    label: 'Long-range rate (€/km)',
    hint: 'Charged when distance is above mid-range max.',
  },
  {
    section: 'seats',
    key: 'infantCarrierFare',
    label: 'Infant carrier (€)',
    hint: 'Flat fee per infant carrier.',
  },
  {
    section: 'seats',
    key: 'childSeatFare',
    label: 'Child seat (€)',
    hint: 'Flat fee per child seat.',
  },
  {
    section: 'seats',
    key: 'boosterFare',
    label: 'Booster (€)',
    hint: 'Flat fee per booster seat.',
  },
];

function tiersToForm(src: PassengerLuggageTier[] | undefined): FormValues['passengerLuggageTiers'] {
  const list = src && src.length > 0 ? src : DEFAULT_TIERS;
  return list.map((t) => ({
    passengers: String(t.passengers),
    luggage: String(t.luggage),
    price: String(t.price),
  }));
}

function emptyForm(): FormValues {
  return {
    shortTripMaxKm: '',
    midMaxKm: '',
    midRateEurPerKm: '',
    longRateEurPerKm: '',
    infantCarrierFare: '',
    childSeatFare: '',
    boosterFare: '',
    passengerLuggageTiers: tiersToForm(DEFAULT_TIERS),
  };
}

function formFromApi(src: PricingSettingsValues | undefined): FormValues {
  return {
    shortTripMaxKm: src == null ? '' : String(src.shortTripMaxKm),
    midMaxKm: src == null ? '' : String(src.midMaxKm),
    midRateEurPerKm: src == null ? '' : String(src.midRateEurPerKm),
    longRateEurPerKm: src == null ? '' : String(src.longRateEurPerKm),
    infantCarrierFare: src == null ? '' : String(src.infantCarrierFare),
    childSeatFare: src == null ? '' : String(src.childSeatFare),
    boosterFare: src == null ? '' : String(src.boosterFare),
    passengerLuggageTiers: tiersToForm(src?.passengerLuggageTiers),
  };
}

function parseTiers(tiers: FormValues['passengerLuggageTiers']): PassengerLuggageTier[] {
  if (!tiers.length || tiers.length < MIN_TIERS) {
    throw new Error(`At least ${MIN_TIERS} passenger/luggage tiers are required.`);
  }
  return tiers.map((tier, index) => {
    const passengers = Number(tier.passengers);
    const luggage = Number(tier.luggage);
    const price = Number(tier.price);
    if (![passengers, luggage, price].every(Number.isFinite)) {
      throw new Error(`Tier ${index + 1}: all fields must be valid numbers.`);
    }
    if (passengers < 1) {
      throw new Error(`Tier ${index + 1}: passengers must be at least 1.`);
    }
    if (luggage < 0 || price < 0) {
      throw new Error(`Tier ${index + 1}: luggage and price cannot be negative.`);
    }
    const rounded = {
      passengers: Math.round(passengers),
      luggage: Math.round(luggage),
      price: Math.round(price),
    };
    const floor = defaultTierMinPrice(rounded.passengers, rounded.luggage);
    if (floor != null && rounded.price < floor) {
      throw new Error(
        `Tier ${index + 1}: price for ${rounded.passengers} passengers / ${rounded.luggage} luggage cannot be below the default (€${floor}).`,
      );
    }
    return rounded;
  });
}

function parsePayload(values: FormValues): PricingSettingsValues {
  const shortTripMaxKm = Number(values.shortTripMaxKm);
  const midMaxKm = Number(values.midMaxKm);
  const midRateEurPerKm = Number(values.midRateEurPerKm);
  const longRateEurPerKm = Number(values.longRateEurPerKm);
  const infantCarrierFare = Number(values.infantCarrierFare);
  const childSeatFare = Number(values.childSeatFare);
  const boosterFare = Number(values.boosterFare);
  const passengerLuggageTiers = parseTiers(values.passengerLuggageTiers);

  if (
    ![
      shortTripMaxKm,
      midMaxKm,
      midRateEurPerKm,
      longRateEurPerKm,
      infantCarrierFare,
      childSeatFare,
      boosterFare,
    ].every(Number.isFinite)
  ) {
    throw new Error('All fields must be valid numbers.');
  }
  if (shortTripMaxKm <= 0 || midMaxKm <= 0) {
    throw new Error('Distance thresholds must be greater than zero.');
  }
  if (midMaxKm <= shortTripMaxKm) {
    throw new Error('Mid-range max km must be greater than short-trip max km.');
  }
  if (
    midRateEurPerKm < 0 ||
    longRateEurPerKm < 0 ||
    infantCarrierFare < 0 ||
    childSeatFare < 0 ||
    boosterFare < 0
  ) {
    throw new Error('Rates and fees cannot be negative.');
  }

  return {
    shortTripMaxKm,
    midMaxKm,
    midRateEurPerKm,
    longRateEurPerKm,
    infantCarrierFare: Math.round(infantCarrierFare),
    childSeatFare: Math.round(childSeatFare),
    boosterFare: Math.round(boosterFare),
    passengerLuggageTiers,
  };
}

export function PricesScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [gateKey, setGateKey] = useState(0);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [defaults, setDefaults] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const fieldInputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const lastFocusedField = useRef<string | null>(null);
  const keyboardBottomInsetRef = useRef(0);

  const keyboardOpen = keyboardBottomInset > 0;

  const scrollBottomPad = useMemo(() => {
    const basePad = spacing.xxl + insets.bottom + spacing.xl;
    if (!keyboardOpen) return basePad;
    return basePad + KEYBOARD_SCROLL_EXTRA_PAD + keyboardBottomInset;
  }, [insets.bottom, keyboardBottomInset, keyboardOpen]);

  const scrollFocusedFieldIntoView = useCallback((fieldId?: string | null) => {
    const id = fieldId ?? lastFocusedField.current;
    if (!id) return;
    const node = fieldInputRefs.current[id];
    const scroll = scrollRef.current;
    if (!node || !scroll) return;

    node.measureInWindow((_x, y, _w, height) => {
      const windowH = Dimensions.get('window').height;
      const keyboardH = keyboardBottomInsetRef.current;
      const visibleBottom = windowH - Math.max(keyboardH, 0) - spacing.xl * 2;
      const fieldBottom = y + height;
      if (fieldBottom <= visibleBottom && y >= spacing.lg) {
        return;
      }
      const delta =
        fieldBottom > visibleBottom
          ? fieldBottom - visibleBottom
          : y < spacing.lg
            ? y - spacing.lg
            : 0;
      if (delta === 0) return;
      scroll.scrollTo({
        y: Math.max(0, scrollYRef.current + delta),
        animated: true,
      });
    });
  }, []);

  const onFieldFocus = useCallback(
    (fieldId: string) => {
      lastFocusedField.current = fieldId;
      const delay = Platform.OS === 'ios' ? 80 : 120;
      setTimeout(() => scrollFocusedFieldIntoView(fieldId), delay);
    },
    [scrollFocusedFieldIntoView],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      keyboardBottomInsetRef.current = height;
      setKeyboardBottomInset(height);
      const id = lastFocusedField.current;
      if (id) {
        const delay = Platform.OS === 'ios' ? 80 : 160;
        setTimeout(() => scrollFocusedFieldIntoView(id), delay);
      }
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      keyboardBottomInsetRef.current = 0;
      setKeyboardBottomInset(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [scrollFocusedFieldIntoView]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await pricingApi.get(accessToken);
      setValues(formFromApi(result.values));
      setDefaults(formFromApi(result.defaults));
    } catch (err) {
      setGateKey((k) => k + 1);
      Alert.alert('Could not load prices', getAppUiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      setValues(emptyForm());
      setDefaults(emptyForm());
    }, []),
  );

  const setField = (key: ScalarKey, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
  };

  const setTierField = (
    index: number,
    field: 'passengers' | 'luggage' | 'price',
    text: string,
  ) => {
    setValues((prev) => ({
      ...prev,
      passengerLuggageTiers: prev.passengerLuggageTiers.map((tier, i) =>
        i === index ? { ...tier, [field]: text } : tier,
      ),
    }));
  };

  const addTier = () => {
    setValues((prev) => {
      const last = prev.passengerLuggageTiers[prev.passengerLuggageTiers.length - 1];
      return {
        ...prev,
        passengerLuggageTiers: [
          ...prev.passengerLuggageTiers,
          {
            passengers: last?.passengers ?? '1',
            luggage: last?.luggage ?? '0',
            price: last?.price ?? '0',
          },
        ],
      };
    });
  };

  const removeTier = (index: number) => {
    setValues((prev) => {
      if (prev.passengerLuggageTiers.length <= MIN_TIERS) return prev;
      return {
        ...prev,
        passengerLuggageTiers: prev.passengerLuggageTiers.filter((_, i) => i !== index),
      };
    });
  };

  const onReset = () => {
    setValues({
      ...defaults,
      passengerLuggageTiers: defaults.passengerLuggageTiers.map((t) => ({ ...t })),
    });
    Alert.alert('Reset', 'Form reset to defaults. Tap Save to apply.');
  };

  const onSave = async () => {
    if (!accessToken || saving) return;
    try {
      const payload = parsePayload(values);
      setSaving(true);
      const result = await pricingApi.update(accessToken, payload);
      setValues(formFromApi(result.values));
      setDefaults(formFromApi(result.defaults));
      Alert.alert('Saved', 'Pricing settings saved.');
    } catch (err) {
      Alert.alert('Could not save', getAppUiMessage(err) || (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (id: 'distance' | 'seats', title: string, subtitle: string) => {
    const fields = FIELDS.filter((f) => f.section === id);
    return (
      <View style={styles.section} key={id}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        {fields.map((field) => {
          const def = defaults[field.key];
          const hint = def ? `${field.hint} · Default: ${def}` : field.hint;
          return (
            <View style={styles.field} key={field.key}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                ref={(ref) => {
                  fieldInputRefs.current[field.key] = ref;
                }}
                style={styles.input}
                keyboardType="decimal-pad"
                value={values[field.key]}
                onChangeText={(t) => setField(field.key, t)}
                onFocus={() => onFieldFocus(field.key)}
                editable={!loading && !saving}
                placeholder="0"
                placeholderTextColor={colors.primaryMuted}
              />
              <Text style={styles.fieldHint}>{hint}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTiers = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Passenger / luggage base</Text>
      <Text style={styles.sectionSubtitle}>
        Base fare tiers (minimum {MIN_TIERS}). Price cannot go below the default for the same
        passengers/luggage pair.
      </Text>
      {values.passengerLuggageTiers.map((tier, index) => (
        <View style={styles.tierCard} key={`tier-${index}`}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierTitle}>Tier {index + 1}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={saving || values.passengerLuggageTiers.length <= MIN_TIERS}
              onPress={() => removeTier(index)}
              style={({ pressed }) => [
                styles.tierRemoveBtn,
                pressed && values.passengerLuggageTiers.length > MIN_TIERS && !saving && styles.resetPressed,
                (saving || values.passengerLuggageTiers.length <= MIN_TIERS) && styles.resetDisabled,
              ]}
            >
              <Text style={styles.tierRemoveLabel}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.tierRow}>
            {(
              [
                ['passengers', 'Passengers', '1'],
                ['luggage', 'Luggage', '0'],
                ['price', 'Price (€)', '0'],
              ] as const
            ).map(([field, label, placeholder]) => {
              const fieldId = `tier-${index}-${field}`;
              const passengers = Number(tier.passengers);
              const luggage = Number(tier.luggage);
              const floor =
                field === 'price' && Number.isFinite(passengers) && Number.isFinite(luggage)
                  ? defaultTierMinPrice(Math.round(passengers), Math.round(luggage))
                  : null;
              return (
                <View style={styles.tierField} key={fieldId}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    ref={(ref) => {
                      fieldInputRefs.current[fieldId] = ref;
                    }}
                    style={styles.input}
                    keyboardType="number-pad"
                    value={tier[field]}
                    onChangeText={(t) => setTierField(index, field, t)}
                    onFocus={() => onFieldFocus(fieldId)}
                    editable={!loading && !saving}
                    placeholder={placeholder}
                    placeholderTextColor={colors.primaryMuted}
                  />
                  {floor != null ? <Text style={styles.fieldHint}>Min €{floor}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={addTier}
        style={({ pressed }) => [
          styles.addTierBtn,
          pressed && !saving && styles.resetPressed,
          saving && styles.resetDisabled,
        ]}
      >
        <Text style={styles.resetLabel}>Add tier</Text>
      </Pressable>
    </View>
  );

  return (
    <PricingPasscodeGate key={gateKey} onUnlocked={() => void load()}>
      <Screen style={styles.screenRoot}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={brandBlue} />
              <Text style={styles.loadingText}>Loading pricing settings…</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.scrollFlex}
              contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={keyboardOpen}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.intro}>
                Passenger/luggage tiers, distance surcharge, and child seat fees used for booking quotes.
              </Text>
              {renderTiers()}
              {renderSection(
                'distance',
                'Distance surcharge',
                'Applied when trip distance meets or exceeds the short-trip threshold.',
              )}
              {renderSection(
                'seats',
                'Child seats',
                'Flat add-on per infant carrier, child seat, or booster.',
              )}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={onReset}
                  style={({ pressed }) => [
                    styles.resetBtn,
                    pressed && !saving && styles.resetPressed,
                    saving && styles.resetDisabled,
                  ]}
                >
                  <Text style={styles.resetLabel}>Reset to defaults</Text>
                </Pressable>
                <PrimaryButton label="Save" onPress={() => void onSave()} loading={saving} style={styles.saveBtn} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Screen>
    </PricingPasscodeGate>
  );
}

type PricesHeaderNav = {
  goBack(): void;
};

export function pricesScreenOptions({ navigation }: { navigation: PricesHeaderNav }) {
  return {
    headerShown: false,
    title: 'Prices',
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
  scroll: { padding: spacing.md },
  intro: {
    ...typography.body,
    color: '#607D8B',
    marginBottom: spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: '#607D8B',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: '#263238',
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: '#78909C',
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#455A64',
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: '#212121',
    backgroundColor: '#FFFFFF',
  },
  fieldHint: {
    ...typography.caption,
    color: '#90A4AE',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  tierCard: {
    borderWidth: 1,
    borderColor: '#E0E6EA',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#FAFCFD',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tierTitle: {
    ...typography.subtitle,
    color: '#37474F',
    fontWeight: '700',
  },
  tierRemoveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tierRemoveLabel: {
    ...typography.caption,
    color: '#78909C',
    fontWeight: '700',
  },
  tierRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierField: {
    flex: 1,
  },
  addTierBtn: {
    borderWidth: 1,
    borderColor: '#CFD8DC',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: '#CFD8DC',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resetPressed: { opacity: 0.85 },
  resetDisabled: { opacity: 0.5 },
  resetLabel: {
    ...typography.subtitle,
    color: '#546E7A',
    fontWeight: '700',
  },
  saveBtn: {
    alignSelf: 'stretch',
    borderRadius: 6,
    paddingVertical: spacing.md,
  },
  headerIconBtn: {
    marginLeft: 4,
    padding: 4,
  },
  headerPressed: { opacity: 0.7 },
});
