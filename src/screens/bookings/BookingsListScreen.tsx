import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookingListRow } from '../../components/bookings/BookingListRow';
import { AnimatedEmptyList, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import type { BookingsStackParamList } from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import type { Booking, BookingListTimeScope } from '../../types/booking';
import { colors, spacing, typography } from '../../theme';

const PAGE_SIZE = 25;

const SECTIONS: { key: BookingListTimeScope; label: string }[] = [
  { key: 'past', label: 'Past' },
  { key: 'current', label: 'Current' },
  { key: 'upcoming', label: 'Upcoming' },
];

type SectionState = {
  items: Booking[];
  /** Highest page number merged into `items` (0 = nothing loaded yet). */
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
};

function emptySection(): SectionState {
  return {
    items: [],
    page: 0,
    totalPages: 0,
    total: 0,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
  };
}

export function BookingsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Booking>>(null);
  const appendLockRef = useRef(false);

  const [active, setActive] = useState<BookingListTimeScope>('current');
  const [byScope, setByScope] = useState<Record<BookingListTimeScope, SectionState>>({
    past: emptySection(),
    current: emptySection(),
    upcoming: emptySection(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const byScopeRef = useRef(byScope);
  byScopeRef.current = byScope;

  const refreshScope = useCallback(
    async (scope: BookingListTimeScope) => {
      if (!accessToken) {
        setByScope((prev) => ({
          ...prev,
          [scope]: {
            ...emptySection(),
            error: 'Not signed in.',
            loading: false,
          },
        }));
        return;
      }
      setByScope((prev) => ({
        ...prev,
        [scope]: {
          ...prev[scope],
          error: null,
          loadMoreError: null,
          loading: true,
          loadingMore: false,
        },
      }));
      try {
        const res = await bookingsApi.list(accessToken, {
          page: 1,
          pageSize: PAGE_SIZE,
          timeScope: scope,
        });
        setByScope((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            items: res.data,
            page: res.page,
            totalPages: res.totalPages,
            total: res.total,
            loading: false,
            loadingMore: false,
            error: null,
            loadMoreError: null,
          },
        }));
      } catch (e) {
        logger.warn('BookingsListScreen: fetch failed', e);
        setByScope((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            loading: false,
            loadingMore: false,
            error: e instanceof Error ? e.message : 'Could not load bookings.',
            items: [],
            page: 0,
            total: 0,
            totalPages: 0,
            loadMoreError: null,
          },
        }));
      }
    },
    [accessToken],
  );

  const loadNextPage = useCallback(
    async (scope: BookingListTimeScope) => {
      if (!accessToken || appendLockRef.current) {
        return;
      }
      const st = byScopeRef.current[scope];
      if (st.loading || st.loadingMore || st.items.length === 0) {
        return;
      }
      if (st.totalPages > 0 && st.page >= st.totalPages) {
        return;
      }

      appendLockRef.current = true;
      setByScope((prev) => ({
        ...prev,
        [scope]: {
          ...prev[scope],
          loadingMore: true,
          loadMoreError: null,
        },
      }));
      try {
        const nextPage = st.page + 1;
        const res = await bookingsApi.list(accessToken, {
          page: nextPage,
          pageSize: PAGE_SIZE,
          timeScope: scope,
        });
        setByScope((prev) => {
          const cur = prev[scope];
          const seen = new Set(cur.items.map((b) => b.uuid));
          const merged = [...cur.items];
          for (const b of res.data) {
            if (!seen.has(b.uuid)) {
              seen.add(b.uuid);
              merged.push(b);
            }
          }
          return {
            ...prev,
            [scope]: {
              ...cur,
              items: merged,
              page: res.page,
              totalPages: res.totalPages,
              total: res.total,
              loadingMore: false,
              loadMoreError: null,
            },
          };
        });
      } catch (e) {
        logger.warn('BookingsListScreen: load more failed', e);
        setByScope((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            loadingMore: false,
            loadMoreError:
              e instanceof Error ? e.message : 'Could not load more bookings.',
          },
        }));
      } finally {
        appendLockRef.current = false;
      }
    },
    [accessToken],
  );

  const scrollListTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const selectTab = useCallback(
    (scope: BookingListTimeScope) => {
      setActive(scope);
      void refreshScope(scope).then(scrollListTop);
    },
    [refreshScope, scrollListTop],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshScope(activeRef.current).then(scrollListTop);
    }, [refreshScope, scrollListTop]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const scope = activeRef.current;
    await refreshScope(scope);
    scrollListTop();
    setRefreshing(false);
  }, [refreshScope, scrollListTop]);

  const onEndReached = useCallback(() => {
    void loadNextPage(activeRef.current);
  }, [loadNextPage]);

  const section = byScope[active];
  const emptyCopy =
    active === 'past'
      ? 'No past trips yet.'
      : active === 'current'
        ? 'No active or overdue trips right now.'
        : 'Nothing scheduled ahead.';
  const emptyIcon =
    active === 'past'
      ? 'archive-outline'
      : active === 'current'
        ? 'car-sport-outline'
        : 'calendar-outline';

  const listPad = [
    styles.listPad,
    { paddingBottom: spacing.lg + insets.bottom },
  ];

  const listFooter =
    section.loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    ) : section.loadMoreError ? (
      <Text style={styles.footerError}>{section.loadMoreError}</Text>
    ) : null;

  if (section.loading && section.items.length === 0) {
    return (
      <Screen style={styles.flex}>
        <View style={styles.tabs}>
          {SECTIONS.map(({ key, label }) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active === key }}
              onPress={() => selectTab(key)}
              style={[styles.tab, active === key && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active === key && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.listArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.flex}>
      <View style={styles.tabs}>
        {SECTIONS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active === key }}
            onPress={() => selectTab(key)}
            style={[styles.tab, active === key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, active === key && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.listArea}>
        {section.error && section.items.length === 0 ? (
          <View style={styles.pad}>
            <Text style={styles.error}>{section.error}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={section.items}
            keyExtractor={(item) => item.uuid}
            extraData={active}
            contentContainerStyle={listPad}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            ListFooterComponent={listFooter}
            ListEmptyComponent={
              <AnimatedEmptyList key={active} icon={emptyIcon} message={emptyCopy} />
            }
            renderItem={({ item }) => (
              <BookingListRow
                booking={item}
                onPress={() => navigation.navigate('BookingDetail', { uuid: item.uuid })}
                onPassengerNamePress={(customerName) =>
                  navigation.navigate('PickupSign', { customerName })
                }
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listArea: { flex: 1, minHeight: 0 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryMuted,
  },
  tabLabelActive: {
    color: colors.accent,
  },
  pad: { padding: spacing.lg },
  listPad: { padding: spacing.lg, flexGrow: 1 },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { ...typography.body, color: colors.danger },
});
