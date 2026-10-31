import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { PricingPasscodeGate, PrimaryButton, Screen } from '../../components';
import { getAppUiMessage } from '../../lib/apiErrors';
import { HeaderSignOutButton } from '../../navigation/driverChrome';
import {
  fetchPlaces,
  fetchRouteQuote,
  type PlaceSuggestion,
  type RouteQuoteResponse,
} from '../../services/routing/routingApi';
import { colors, spacing, typography } from '../../theme';

const brandBlue = '#1E88E5';
const MAX_PASSENGERS = 8;
const MAX_LUGGAGE = 16;
const MAX_SEAT = 4;
const PLACES_DEBOUNCE_MS = 300;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatEur(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `€${Math.round(Number(value))}`;
}

type AddressSide = 'from' | 'to';

type PlaceFieldState = {
  suggestions: PlaceSuggestion[];
  loading: boolean;
  open: boolean;
  suppress: boolean;
};

function emptyPlaceState(): PlaceFieldState {
  return { suggestions: [], loading: false, open: false, suppress: false };
}

function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onPress={() => onChange(clamp(value - 1, min, max))}
          style={({ pressed }) => [
            styles.stepperBtn,
            pressed && value > min && !disabled && styles.pressed,
            (disabled || value <= min) && styles.disabled,
          ]}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          disabled={disabled || value >= max}
          onPress={() => onChange(clamp(value + 1, min, max))}
          style={({ pressed }) => [
            styles.stepperBtn,
            pressed && value < max && !disabled && styles.pressed,
            (disabled || value >= max) && styles.disabled,
          ]}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={[styles.stat, emphasis && styles.statEmphasis]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function CalculateScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(1);
  const [infantCarrierCount, setInfantCarrierCount] = useState(0);
  const [childSeatCount, setChildSeatCount] = useState(0);
  const [boosterCount, setBoosterCount] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [quote, setQuote] = useState<RouteQuoteResponse | null>(null);

  const [fromPlaces, setFromPlaces] = useState<PlaceFieldState>(emptyPlaceState);
  const [toPlaces, setToPlaces] = useState<PlaceFieldState>(emptyPlaceState);

  const fromTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGen = useRef({ from: 0, to: 0 });

  const clearTimers = useCallback(() => {
    if (fromTimer.current) clearTimeout(fromTimer.current);
    if (toTimer.current) clearTimeout(toTimer.current);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const schedulePlaces = useCallback((side: AddressSide, query: string, suppress: boolean) => {
    const timerRef = side === 'from' ? fromTimer : toTimer;
    const setPlaces = side === 'from' ? setFromPlaces : setToPlaces;
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (suppress || trimmed.length < 1) {
      setPlaces((prev) => ({ ...prev, suggestions: [], loading: false, open: false }));
      return;
    }

    setPlaces((prev) => ({ ...prev, loading: true, open: true }));
    const gen = ++requestGen.current[side];
    timerRef.current = setTimeout(() => {
      void fetchPlaces(trimmed)
        .then((results) => {
          if (requestGen.current[side] !== gen) return;
          setPlaces({
            suggestions: results,
            loading: false,
            open: true,
            suppress: false,
          });
        })
        .catch(() => {
          if (requestGen.current[side] !== gen) return;
          setPlaces({
            suggestions: [],
            loading: false,
            open: false,
            suppress: false,
          });
        });
    }, PLACES_DEBOUNCE_MS);
  }, []);

  const onChangeAddress = (side: AddressSide, text: string) => {
    if (side === 'from') {
      setFrom(text);
      setFromPlaces((prev) => ({ ...prev, suppress: false }));
      schedulePlaces('from', text, false);
    } else {
      setTo(text);
      setToPlaces((prev) => ({ ...prev, suppress: false }));
      schedulePlaces('to', text, false);
    }
    setQuote(null);
  };

  const selectPlace = (side: AddressSide, description: string) => {
    if (side === 'from') {
      setFrom(description);
      setFromPlaces({ suggestions: [], loading: false, open: false, suppress: true });
    } else {
      setTo(description);
      setToPlaces({ suggestions: [], loading: false, open: false, suppress: true });
    }
    setQuote(null);
  };

  const renderPlaceField = (
    side: AddressSide,
    label: string,
    value: string,
    meta: PlaceFieldState,
  ) => (
    <View style={styles.field} key={side}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => onChangeAddress(side, t)}
        onFocus={() => {
          if (!meta.suppress && value.trim().length >= 1) {
            if (side === 'from') setFromPlaces((p) => ({ ...p, open: true }));
            else setToPlaces((p) => ({ ...p, open: true }));
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            if (side === 'from') setFromPlaces((p) => ({ ...p, open: false }));
            else setToPlaces((p) => ({ ...p, open: false }));
          }, 180);
        }}
        editable={!calculating}
        placeholder={side === 'from' ? 'Pickup address' : 'Drop-off address'}
        placeholderTextColor={colors.primaryMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {meta.open && (meta.loading || meta.suggestions.length > 0) ? (
        <View style={styles.suggestions}>
          {meta.loading && meta.suggestions.length === 0 ? (
            <View style={styles.suggestionRow}>
              <ActivityIndicator size="small" color={brandBlue} />
              <Text style={styles.suggestionStatus}>Searching…</Text>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={meta.suggestions}
              keyExtractor={(item, index) => `${item.placeId || item.description}-${index}`}
              scrollEnabled={meta.suggestions.length > 4}
              style={styles.suggestionsList}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectPlace(side, item.description)}
                  style={({ pressed }) => [styles.suggestionItem, pressed && styles.pressed]}
                >
                  <Text style={styles.suggestionText}>{item.description}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );

  const onCalculate = async () => {
    const fromTrim = from.trim();
    const toTrim = to.trim();
    if (!fromTrim || !toTrim) {
      Alert.alert('Missing addresses', 'Enter both pickup and drop-off addresses.');
      return;
    }
    setCalculating(true);
    setQuote(null);
    try {
      const result = await fetchRouteQuote({
        from: fromTrim,
        to: toTrim,
        passengerCount,
        luggageCount,
        infantCarrierCount,
        childSeatCount,
        boosterCount,
        isReturnTrip: false,
      });
      setQuote(result);
    } catch (err) {
      Alert.alert('Could not calculate', getAppUiMessage(err));
    } finally {
      setCalculating(false);
    }
  };

  const oneWay = quote?.oneWayPriceEur ?? quote?.estimatedPriceEur;
  const returnPrice =
    quote?.returnPriceEur ?? (oneWay != null ? Number(oneWay) * 2 : null);

  return (
    <PricingPasscodeGate>
      <Screen style={styles.screenRoot}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.intro}>
              Enter pickup and drop-off to get distance and fare (one-way and return).
            </Text>

            <Text style={styles.sectionTitle}>Route</Text>
            <Text style={styles.sectionSubtitle}>
              Addresses use Google Places suggestions, same as booking.
            </Text>
            {renderPlaceField('from', 'Pick up', from, fromPlaces)}
            {renderPlaceField('to', 'Drop off', to, toPlaces)}

            <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Passengers & options</Text>
            <Text style={styles.sectionSubtitle}>Affects base tier and seat add-ons.</Text>
            <View style={styles.steppers}>
              <Stepper
                label="Passengers"
                value={passengerCount}
                min={1}
                max={MAX_PASSENGERS}
                disabled={calculating}
                onChange={setPassengerCount}
              />
              <Stepper
                label="Luggage"
                value={luggageCount}
                min={0}
                max={MAX_LUGGAGE}
                disabled={calculating}
                onChange={setLuggageCount}
              />
              <Stepper
                label="Infant carrier"
                value={infantCarrierCount}
                min={0}
                max={MAX_SEAT}
                disabled={calculating}
                onChange={setInfantCarrierCount}
              />
              <Stepper
                label="Child seat"
                value={childSeatCount}
                min={0}
                max={MAX_SEAT}
                disabled={calculating}
                onChange={setChildSeatCount}
              />
              <Stepper
                label="Booster"
                value={boosterCount}
                min={0}
                max={MAX_SEAT}
                disabled={calculating}
                onChange={setBoosterCount}
              />
            </View>

            <PrimaryButton
              label="Calculate"
              onPress={() => void onCalculate()}
              loading={calculating}
              style={styles.calcBtn}
            />

            {quote ? (
              <View style={styles.results}>
                <Text style={styles.sectionTitle}>Result</Text>
                <Text style={styles.sectionSubtitle}>Same engine as customer booking quotes.</Text>
                <View style={styles.statsGrid}>
                  <Stat label="Distance" value={`${quote.distanceKm} km`} />
                  <Stat label="Duration" value={`${quote.durationMinutes} min`} />
                  <Stat label="Base (pax/luggage)" value={formatEur(quote.baseFareEur)} />
                  <Stat label="Distance surcharge" value={formatEur(quote.distanceSurchargeEur)} />
                  <Stat label="One-way price" value={formatEur(oneWay)} emphasis />
                  <Stat label="Return price" value={formatEur(returnPrice)} emphasis />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </PricingPasscodeGate>
  );
}

type CalculateHeaderNav = {
  goBack(): void;
};

export function calculateScreenOptions({ navigation }: { navigation: CalculateHeaderNav }) {
  return {
    headerShown: false,
    title: 'Calculate',
    headerStyle: { backgroundColor: brandBlue },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' as const, fontSize: 18 },
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
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
  intro: {
    ...typography.body,
    color: '#607D8B',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: '#263238',
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSpaced: { marginTop: spacing.lg },
  sectionSubtitle: {
    ...typography.caption,
    color: '#78909C',
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
    zIndex: 1,
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
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  suggestionStatus: {
    ...typography.caption,
    color: '#90A4AE',
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEFF1',
  },
  suggestionText: {
    ...typography.body,
    color: '#263238',
  },
  steppers: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepper: {
    borderWidth: 1,
    borderColor: '#E0E6EA',
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: '#FAFCFD',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#455A64',
    marginBottom: spacing.sm,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#37474F',
    lineHeight: 22,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#263238',
    minWidth: 28,
    textAlign: 'center',
  },
  calcBtn: {
    alignSelf: 'stretch',
    borderRadius: 6,
    paddingVertical: spacing.md,
  },
  results: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E0E6EA',
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  statEmphasis: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#607D8B',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#263238',
  },
  headerIconBtn: {
    marginLeft: 4,
    padding: 4,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
