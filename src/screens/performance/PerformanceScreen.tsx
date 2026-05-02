import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { DriverInvoiceAnalytics } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

import { performanceStatic } from './performanceStatic';

const PLOT_HEIGHT = 128;

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMoneyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function shortWeekdayUtc(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

function shortMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) {
    return ym;
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

export function PerformanceScreen() {
  const { accessToken } = useAuth();
  const winW = Dimensions.get('window').width;
  const chartInnerW = winW - spacing.lg * 2 - spacing.sm * 2;
  const p = performanceStatic;

  const [inv, setInv] = useState<DriverInvoiceAnalytics | null>(null);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    if (!accessToken) {
      setInv(null);
      setInvError(null);
      setInvLoading(false);
      return;
    }
    setInvLoading(true);
    setInvError(null);
    try {
      const data = await invoicesApi.analytics(accessToken);
      setInv(data);
    } catch (e) {
      logger.warn('PerformanceScreen: invoice analytics failed', e);
      setInv(null);
      setInvError(e instanceof Error ? e.message : 'Could not load invoice analytics.');
    } finally {
      setInvLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadInvoices();
    }, [loadInvoices]),
  );

  const inv7 = useMemo(() => {
    if (!inv?.last7Days?.length) {
      return { values: [] as number[], max: 1, labels: [] as string[] };
    }
    const values = inv.last7Days.map((d) => d.total);
    const max = Math.max(...values, 1);
    const labels = inv.last7Days.map((d) => shortWeekdayUtc(d.date));
    return { values, max, labels };
  }, [inv]);

  const inv6 = useMemo(() => {
    if (!inv?.last6Months?.length) {
      return { values: [] as number[], max: 1, labels: [] as string[] };
    }
    const values = inv.last6Months.map((m) => m.total);
    const max = Math.max(...values, 1);
    const labels = inv.last6Months.map((m) => shortMonthLabel(m.month));
    return { values, max, labels };
  }, [inv]);

  const revenueBars = useMemo(() => {
    const values = [...performanceStatic.revenueByDay];
    const max = Math.max(...values, 1);
    return { values, max };
  }, []);

  const weeklyBars = useMemo(() => {
    const completed = [...performanceStatic.weeklyCompleted];
    const cancelled = [...performanceStatic.weeklyCancelled];
    const max = Math.max(...completed, ...cancelled, 1) * 1.1;
    return { completed, cancelled, max };
  }, []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Performance</Text>
        <Text style={styles.sub}>
          Invoice totals and charts use your saved invoices (UTC buckets). Trip charts below are
          sample placeholders.
        </Text>

        <View style={styles.liveHeader}>
          <Text style={styles.invoiceSectionTitle}>Invoices</Text>
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>Live</Text>
          </View>
        </View>

        {invLoading ? (
          <View style={styles.invBlock}>
            <ActivityIndicator color={colors.success} />
          </View>
        ) : invError ? (
          <Text style={styles.invError}>{invError}</Text>
        ) : inv ? (
          <>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, styles.kpiWide]}>
                <Text style={styles.kpiLabel}>Invoiced (all time)</Text>
                <Text style={[styles.kpiValue, styles.kpiSuccess]}>
                  {formatMoneyDetailed(inv.sums.total)}
                </Text>
                <Text style={styles.kpiHint}>
                  {inv.count} invoice{inv.count === 1 ? '' : 's'} · subtotal{' '}
                  {formatMoney(inv.sums.subtotal)} + tax {formatMoney(inv.sums.tax)}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Avg / invoice</Text>
                <Text style={styles.kpiValue}>{formatMoney(inv.averageInvoiceTotal)}</Text>
                <Text style={styles.kpiHint}>mean total</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>From booking</Text>
                <Text style={styles.kpiValue}>{inv.linkedFromBookingCount}</Text>
                <Text style={styles.kpiHint}>linked saves</Text>
              </View>
            </View>

            <Text style={styles.sectionTitleMuted}>Invoiced totals (7 days, UTC)</Text>
            <View style={styles.chartCard}>
              <View style={[styles.barPlot, { width: chartInnerW, height: PLOT_HEIGHT + 22 }]}>
                <View style={styles.barRow}>
                  {inv7.values.map((v, i) => {
                    const h = Math.max((v / inv7.max) * PLOT_HEIGHT, v > 0 ? 4 : 2);
                    return (
                      <View key={i} style={styles.barColumn}>
                        <View style={styles.barTrack}>
                          <LinearGradient
                            colors={[colors.success, `${colors.success}66`]}
                            style={[styles.barFill, { height: h }]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{inv7.labels[i]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitleMuted}>Invoiced totals by month (6 months, UTC)</Text>
            <View style={styles.chartCard}>
              <View style={[styles.barPlot, { width: chartInnerW, height: PLOT_HEIGHT + 22 }]}>
                <View style={styles.barRow}>
                  {inv6.values.map((v, i) => {
                    const h = Math.max((v / inv6.max) * PLOT_HEIGHT, v > 0 ? 4 : 2);
                    return (
                      <View key={i} style={styles.barColumn}>
                        <View style={styles.barTrack}>
                          <LinearGradient
                            colors={['#059669', `${colors.success}99`]}
                            style={[styles.barFill, { height: h }]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{inv6.labels[i]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sampleDivider]}>Trips (sample)</Text>
        <Text style={styles.sampleHint}>Illustrative data only — not tied to your bookings yet.</Text>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiWide]}>
            <Text style={styles.kpiLabel}>Total revenue</Text>
            <Text style={styles.kpiValue}>{formatMoneyDetailed(p.totalRevenue)}</Text>
            <Text style={styles.kpiHint}>{p.completedBookings} completed trips</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Cancelled</Text>
            <Text style={[styles.kpiValue, styles.kpiDanger]}>{p.cancelledBookings}</Text>
            <Text style={styles.kpiHint}>bookings</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg / week</Text>
            <Text style={styles.kpiValue}>{p.avgTripsPerWeek.toFixed(1)}</Text>
            <Text style={styles.kpiHint}>trips</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg rating</Text>
            <Text style={styles.kpiValue}>★ {p.avgRating.toFixed(2)}</Text>
            <Text style={styles.kpiHint}>passengers</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg / trip</Text>
            <Text style={styles.kpiValue}>{formatMoney(p.avgRevenuePerTrip)}</Text>
            <Text style={styles.kpiHint}>revenue</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Revenue (last 7 days)</Text>
        <View style={styles.chartCard}>
          <View style={[styles.barPlot, { width: chartInnerW, height: PLOT_HEIGHT + 22 }]}>
            <View style={styles.barRow}>
              {revenueBars.values.map((v, i) => {
                const h = Math.max((v / revenueBars.max) * PLOT_HEIGHT, 4);
                return (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <LinearGradient
                        colors={[colors.accent, `${colors.accent}66`]}
                        style={[styles.barFill, { height: h }]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{p.dayLabels[i]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Trips by week (6 weeks)</Text>
        <View style={styles.chartCard}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.legendText}>Cancelled</Text>
            </View>
          </View>
          <View style={[styles.groupPlot, { width: chartInnerW, height: PLOT_HEIGHT + 22 }]}>
            <View style={styles.groupRow}>
              {weeklyBars.completed.map((c, i) => {
                const can = weeklyBars.cancelled[i] ?? 0;
                const hC = Math.max((c / weeklyBars.max) * PLOT_HEIGHT, 3);
                const hX = Math.max((can / weeklyBars.max) * PLOT_HEIGHT, 2);
                return (
                  <View key={i} style={styles.groupColumn}>
                    <View style={styles.groupBars}>
                      <View style={styles.duoBar}>
                        <LinearGradient
                          colors={[colors.accent, `${colors.accent}99`]}
                          style={[styles.duoFill, { height: hC }]}
                        />
                      </View>
                      <View style={styles.duoBar}>
                        <LinearGradient
                          colors={[colors.danger, `${colors.danger}99`]}
                          style={[styles.duoFill, { height: hX }]}
                        />
                      </View>
                    </View>
                    <Text style={styles.barLabel}>{p.weekLabels[i]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  screenTitle: { ...typography.title, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.lg,
  },
  invoiceSectionTitle: {
    ...typography.subtitle,
    marginTop: 0,
    marginBottom: 0,
    color: colors.primary,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  livePill: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  livePillText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
    fontSize: 11,
  },
  invBlock: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  invError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  sampleDivider: { marginTop: spacing.xl },
  sampleHint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: '42%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiWide: {
    width: '100%',
    flexBasis: '100%',
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginBottom: spacing.xs,
  },
  kpiValue: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
  },
  kpiSuccess: { color: colors.success },
  kpiDanger: { color: colors.danger },
  kpiHint: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitleMuted: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    color: colors.primaryMuted,
    fontSize: 15,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  barPlot: { justifyContent: 'flex-end' },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    height: PLOT_HEIGHT,
    justifyContent: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.xs,
    fontSize: 11,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.primaryMuted },
  groupPlot: { justifyContent: 'flex-end' },
  groupRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  groupColumn: {
    flex: 1,
    alignItems: 'center',
  },
  groupBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: PLOT_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 2,
  },
  duoBar: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  duoFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
});
