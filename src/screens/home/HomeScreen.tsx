import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BookingListRow } from '../../components/bookings/BookingListRow';
import { AnimatedEmptyList, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/bookingFormat';
import { logger } from '../../lib/logger';
import type { DriverDrawerParamList, HomeStackParamList } from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { Booking } from '../../types/booking';
import type { DriverInvoiceAnalytics } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

const LATEST_COUNT = 5;

function currentUtcMonthKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const drawerNav = navigation.getParent<DrawerNavigationProp<DriverDrawerParamList>>();
  const { user, accessToken, refreshProfile, updateAvailability } = useAuth();
  const [latest, setLatest] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [perfInv, setPerfInv] = useState<DriverInvoiceAnalytics | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    if (!accessToken) {
      setLatest([]);
      setBookingsError(null);
      setLoadingBookings(false);
      return;
    }
    setLoadingBookings(true);
    setBookingsError(null);
    try {
      const res = await bookingsApi.list(accessToken, {
        page: 1,
        pageSize: LATEST_COUNT,
        timeScope: 'current',
      });
      setLatest(res.data.slice(0, LATEST_COUNT));
    } catch (e) {
      logger.warn('HomeScreen: current bookings failed', e);
      setBookingsError(e instanceof Error ? e.message : 'Could not load bookings.');
      setLatest([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [accessToken]);

  const loadPerformanceSnapshot = useCallback(async () => {
    if (!accessToken) {
      setPerfInv(null);
      setPerfError(null);
      setPerfLoading(false);
      return;
    }
    setPerfLoading(true);
    setPerfError(null);
    try {
      const data = await invoicesApi.analytics(accessToken);
      setPerfInv(data);
    } catch (e) {
      logger.warn('HomeScreen: invoice analytics failed', e);
      setPerfInv(null);
      setPerfError(e instanceof Error ? e.message : 'Could not load metrics.');
    } finally {
      setPerfLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadLatest();
      void refreshProfile();
      void loadPerformanceSnapshot();
    }, [loadLatest, loadPerformanceSnapshot, refreshProfile]),
  );

  const onToggleAvailability = useCallback(async () => {
    if (!user?.isActive || availabilityBusy) {
      return;
    }
    const next = !user.isAvailable;
    setAvailabilityBusy(true);
    try {
      await updateAvailability(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not update availability.';
      Alert.alert('Update failed', msg);
    } finally {
      setAvailabilityBusy(false);
    }
  }, [user, availabilityBusy, updateAvailability]);

  const revenueDerived = useMemo(() => {
    if (!perfInv) {
      return null;
    }
    const last7Sum = perfInv.last7Days.reduce((s, d) => s + d.total, 0);
    const last7Invoices = perfInv.last7Days.reduce((s, d) => s + d.count, 0);
    const avgPerDay = last7Sum / 7;
    const avgPerInvoice7d = last7Invoices > 0 ? last7Sum / last7Invoices : 0;

    const monthKey = currentUtcMonthKey();
    const monthBucket = perfInv.last6Months.find((b) => b.month === monthKey);
    const monthTotal = monthBucket?.total ?? 0;
    const monthInvoices = monthBucket?.count ?? 0;
    const avgPerInvoiceMonth = monthInvoices > 0 ? monthTotal / monthInvoices : 0;
    const utcDayOfMonth = Math.max(1, new Date().getUTCDate());
    const avgPerDayMonth = monthTotal / utcDayOfMonth;

    const sixSum = perfInv.last6Months.reduce((s, b) => s + b.total, 0);
    const sixMonths = perfInv.last6Months.length || 6;
    const avgPerMonth = sixSum / sixMonths;
    const sixInvoices = perfInv.last6Months.reduce((s, b) => s + b.count, 0);
    const avgPerInvoice6m = sixInvoices > 0 ? sixSum / sixInvoices : 0;

    return {
      last7Sum,
      avgPerDay,
      avgPerInvoice7d,
      monthTotal,
      monthInvoices,
      avgPerInvoiceMonth,
      avgPerDayMonth,
      sixSum,
      avgPerMonth,
      avgPerInvoice6m,
    };
  }, [perfInv]);

  return (
    <Screen style={styles.screenRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.subtitle}>
        You are signed in as a driver. Open the menu for all bookings or your profile.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.cardBody}>Trip requests and earnings will show here.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            user?.isAvailable ? 'Available for trips. Tap to go offline.' : 'Unavailable. Tap to go online.'
          }
          onPress={() => void onToggleAvailability()}
          disabled={!user?.isActive || availabilityBusy}
          style={({ pressed }) => [
            styles.availabilityStrip,
            user?.isAvailable ? styles.availabilityOn : styles.availabilityOff,
            (!user?.isActive || availabilityBusy) && styles.availabilityDisabled,
            pressed && user?.isActive && !availabilityBusy && styles.availabilityPressed,
          ]}
        >
          {availabilityBusy ? (
            <View style={styles.availabilityRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.availabilityBusyLabel}>Updating availability…</Text>
            </View>
          ) : (
            <View style={styles.availabilityRow}>
              <Ionicons
                name={
                  user?.isActive === false
                    ? 'alert-circle-outline'
                    : user?.isAvailable
                      ? 'checkmark-circle'
                      : 'pause-circle-outline'
                }
                size={34}
                color={
                  user?.isActive === false
                    ? colors.danger
                    : user?.isAvailable
                      ? '#15803d'
                      : colors.primaryMuted
                }
                style={styles.availabilityIcon}
              />
              <View style={styles.availabilityTextBlock}>
                <Text
                  style={[
                    styles.availabilityTitle,
                    user?.isAvailable ? styles.availabilityTitleOn : styles.availabilityTitleOff,
                    user?.isActive === false && styles.availabilityTitleInactive,
                  ]}
                >
                  {user?.isActive === false
                    ? 'Account inactive'
                    : user?.isAvailable
                      ? 'Available'
                      : 'Unavailable'}
                </Text>
                <Text style={styles.availabilityHint}>
                  {user?.isActive === false
                    ? 'Contact support if this is unexpected.'
                    : user?.isAvailable
                      ? 'Tap to stop receiving new trips'
                      : 'Tap to receive new trips'}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>

      <View style={[styles.card, styles.latestCard]}>
        <View style={styles.latestHeader}>
          <View style={styles.latestTitleBlock}>
            <Text style={[styles.cardTitle, styles.latestMainTitle]}>Latest bookings</Text>
            <Text style={styles.latestSub}>Up to {LATEST_COUNT} active or overdue trips</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => drawerNav?.navigate('Bookings')}
            hitSlop={8}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {loadingBookings ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : bookingsError ? (
          <Text style={styles.bookingsError}>{bookingsError}</Text>
        ) : latest.length === 0 ? (
          <AnimatedEmptyList
            icon="navigate-circle-outline"
            message="No active or overdue trips right now."
            contentStyle={{ paddingVertical: spacing.lg }}
          />
        ) : (
          latest.map((b) => (
            <BookingListRow
              key={b.uuid}
              booking={b}
              onPress={() => navigation.navigate('BookingDetail', { uuid: b.uuid })}
              onPassengerNamePress={(customerName) =>
                navigation.navigate('PickupSign', { customerName })
              }
            />
          ))
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open performance details"
        onPress={() => drawerNav?.navigate('Performance')}
        style={({ pressed }) => [styles.card, styles.perfCard, pressed && styles.perfPressed]}
      >
        <View style={styles.perfHeader}>
          <Text style={styles.cardTitle}>Performance</Text>
          <Text style={styles.seeAll}>View</Text>
        </View>
        <Text style={styles.perfSub}>Invoice totals (all time)</Text>
        {perfLoading ? (
          <ActivityIndicator style={styles.perfLoader} color={colors.accent} />
        ) : perfError ? (
          <Text style={styles.perfError}>{perfError}</Text>
        ) : perfInv ? (
          <View style={styles.perfMetrics}>
            <View style={styles.perfMetric}>
              <Text style={styles.perfMetricLabel}>Invoiced</Text>
              <Text style={styles.perfMetricValue} numberOfLines={1}>
                {formatMoney(perfInv.sums.total, 'GBP')}
              </Text>
            </View>
            <View style={styles.perfMetric}>
              <Text style={styles.perfMetricLabel}>Invoices</Text>
              <Text style={styles.perfMetricValue}>{perfInv.count}</Text>
            </View>
            <View style={styles.perfMetric}>
              <Text style={styles.perfMetricLabel}>Avg / invoice</Text>
              <Text style={styles.perfMetricValue} numberOfLines={1}>
                {formatMoney(perfInv.averageInvoiceTotal, 'GBP')}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.perfHint}>Tap for charts and full breakdown</Text>
      </Pressable>

      {!perfLoading && !perfError && perfInv && revenueDerived ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open performance, last seven days revenue"
            onPress={() => drawerNav?.navigate('Performance')}
            style={({ pressed }) => [
              styles.card,
              styles.revenueCard,
              pressed && styles.perfPressed,
            ]}
          >
            <Text style={styles.revenueTitle}>Last 7 days (UTC)</Text>
            <Text style={styles.revenueValue}>{formatMoney(revenueDerived.last7Sum, 'GBP')}</Text>
            <Text style={styles.revenueCaption}>Revenue · rolling week</Text>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / day</Text>
              <Text style={styles.revenueAvgValue}>{formatMoney(revenueDerived.avgPerDay, 'GBP')}</Text>
            </View>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / invoice</Text>
              <Text style={styles.revenueAvgValue}>
                {revenueDerived.avgPerInvoice7d > 0
                  ? formatMoney(revenueDerived.avgPerInvoice7d, 'GBP')
                  : '—'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open performance, this month revenue"
            onPress={() => drawerNav?.navigate('Performance')}
            style={({ pressed }) => [
              styles.card,
              styles.revenueCard,
              pressed && styles.perfPressed,
            ]}
          >
            <Text style={styles.revenueTitle}>This month (UTC)</Text>
            <Text style={styles.revenueValue}>{formatMoney(revenueDerived.monthTotal, 'GBP')}</Text>
            <Text style={styles.revenueCaption}>
              {revenueDerived.monthInvoices} invoice{revenueDerived.monthInvoices === 1 ? '' : 's'} so far
            </Text>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / day (MTD)</Text>
              <Text style={styles.revenueAvgValue}>{formatMoney(revenueDerived.avgPerDayMonth, 'GBP')}</Text>
            </View>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / invoice</Text>
              <Text style={styles.revenueAvgValue}>
                {revenueDerived.avgPerInvoiceMonth > 0
                  ? formatMoney(revenueDerived.avgPerInvoiceMonth, 'GBP')
                  : '—'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open performance, six month revenue"
            onPress={() => drawerNav?.navigate('Performance')}
            style={({ pressed }) => [
              styles.card,
              styles.revenueCard,
              pressed && styles.perfPressed,
            ]}
          >
            <Text style={styles.revenueTitle}>Last 6 months (UTC)</Text>
            <Text style={styles.revenueValue}>{formatMoney(revenueDerived.sixSum, 'GBP')}</Text>
            <Text style={styles.revenueCaption}>Revenue · six calendar months</Text>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / month</Text>
              <Text style={styles.revenueAvgValue}>{formatMoney(revenueDerived.avgPerMonth, 'GBP')}</Text>
            </View>
            <View style={styles.revenueAvgRow}>
              <Text style={styles.revenueAvgLabel}>Avg / invoice</Text>
              <Text style={styles.revenueAvgValue}>
                {revenueDerived.avgPerInvoice6m > 0
                  ? formatMoney(revenueDerived.avgPerInvoice6m, 'GBP')
                  : '—'}
              </Text>
            </View>
          </Pressable>
        </>
      ) : null}

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: spacing.xs },
  name: { ...typography.subtitle, color: colors.accent },
  subtitle: {
    ...typography.body,
    color: colors.primaryMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perfCard: { marginTop: spacing.md },
  perfPressed: { opacity: 0.92 },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  perfSub: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  perfLoader: { marginVertical: spacing.sm },
  perfError: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  perfMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  perfMetric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perfMetricLabel: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.xs,
  },
  perfMetricValue: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.primary,
  },
  perfHint: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  revenueCard: { marginTop: spacing.sm },
  revenueTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  revenueValue: {
    ...typography.title,
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  revenueCaption: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  revenueAvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  revenueAvgLabel: { ...typography.body, color: colors.primaryMuted },
  revenueAvgValue: { ...typography.subtitle, fontWeight: '700', color: colors.primary },
  latestCard: { marginTop: spacing.md },
  latestTitleBlock: { flex: 1, marginRight: spacing.sm },
  latestMainTitle: { marginBottom: spacing.xs },
  latestSub: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: 2,
  },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  seeAll: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  cardTitle: { ...typography.subtitle, marginBottom: spacing.sm },
  cardBody: { ...typography.body, color: colors.primaryMuted, marginBottom: spacing.md },
  availabilityStrip: {
    marginTop: spacing.sm,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    minHeight: 80,
    justifyContent: 'center',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  availabilityIcon: { marginTop: 2 },
  availabilityTextBlock: { flex: 1, minWidth: 0 },
  availabilityBusyLabel: {
    ...typography.body,
    color: colors.primaryMuted,
    flex: 1,
  },
  availabilityOn: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.45)',
  },
  availabilityOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  availabilityDisabled: { opacity: 0.55 },
  availabilityPressed: { opacity: 0.88 },
  availabilityTitle: { ...typography.subtitle, fontWeight: '700' },
  availabilityTitleOn: { color: '#15803d' },
  availabilityTitleOff: { color: colors.primaryMuted },
  availabilityTitleInactive: { color: colors.danger },
  availabilityHint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.xs,
  },
  loader: { marginVertical: spacing.md },
  bookingsError: { ...typography.caption, color: colors.danger },
});
