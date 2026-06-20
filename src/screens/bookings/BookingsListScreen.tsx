import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyReservationsCard } from '../../components/bookings/MyReservationsCard';
import { AnimatedEmptyList, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue, triggerViatorInboxRefresh } from '../../hooks';
import { HeaderRefreshAndSignOut } from '../../navigation/driverChrome';
import { getAppUiMessage } from '../../lib/apiErrors';
import {
  bookingDayKeyFromDate,
  bookingDayKeyFromIso,
  currentListWindowKey,
} from '../../lib/bookingDayKey';
import { logger } from '../../lib/logger';
import type { BookingsStackParamList } from '../../navigation/types';
import { bookingsApi } from '../../services/bookings/bookingsApi';
import {
  loadBookingDriverLabels,
  saveBookingDriverLabels,
} from '../../services/preferences/driverListLabelStorage';
import type { Booking, BookingListTimeScope } from '../../types/booking';
import { colors, spacing, typography } from '../../theme';

const PAGE_SIZE = 25;
const DATE_FILTER_PAGE_SIZE = 100;

const BOOKING_REF_DEBOUNCE_MS = 300;

const TABS: { key: BookingListTimeScope; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'current', label: 'Current' },
  { key: 'past', label: 'Past' },
];

const brandBlue = '#1E88E5';

const DEFAULT_DRIVER_LIST_LABEL = 'D.Name';

type SectionState = {
  items: Booking[];
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

function formatSectionTitle(dayKey: string): string {
  const [y, m, day] = dayKey.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, day);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatFilterDateLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

type Section = { title: string; dayKey: string; data: Booking[] };

export function BookingsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const { accessToken, user } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<SectionList<Booking, Section>>(null);
  const appendLockRef = useRef(false);
  const onEndReachedDuringMomentumRef = useRef(false);

  const [active, setActive] = useState<BookingListTimeScope>('current');
  const [byScope, setByScope] = useState<Record<BookingListTimeScope, SectionState>>({
    past: emptySection(),
    current: emptySection(),
    upcoming: emptySection(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  const [bookingRefQuery, setBookingRefQuery] = useState('');
  const debouncedBookingRefQuery = useDebouncedValue(bookingRefQuery, BOOKING_REF_DEBOUNCE_MS);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [bookingDriverLabels, setBookingDriverLabels] = useState<Record<string, string>>({});
  const [editingBookingUuid, setEditingBookingUuid] = useState<string | null>(null);
  const [driverLabelModalVisible, setDriverLabelModalVisible] = useState(false);
  const [driverLabelDraft, setDriverLabelDraft] = useState('');
  const [bookingRefModalVisible, setBookingRefModalVisible] = useState(false);
  const [bookingRefDraft, setBookingRefDraft] = useState('');
  const activeRef = useRef(active);
  activeRef.current = active;
  const byScopeRef = useRef(byScope);
  byScopeRef.current = byScope;
  const filterDateRef = useRef(filterDate);
  filterDateRef.current = filterDate;
  const debouncedBookingRefRef = useRef(debouncedBookingRefQuery);
  debouncedBookingRefRef.current = debouncedBookingRefQuery;
  const currentWindowKeyRef = useRef(currentListWindowKey());

  const scheduledOnForScope = useCallback((scope: BookingListTimeScope): string | undefined => {
    if (scope === 'current' || !filterDateRef.current) {
      return undefined;
    }
    return bookingDayKeyFromDate(filterDateRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        return;
      }
      const map = await loadBookingDriverLabels(user.id);
      if (!cancelled) {
        setBookingDriverLabels(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (active === 'current') {
      setDatePickerVisible(false);
    }
  }, [active]);

  const openDriverLabelEditor = useCallback(
    (bookingUuid: string) => {
      setEditingBookingUuid(bookingUuid);
      const custom = bookingDriverLabels[bookingUuid]?.trim();
      setDriverLabelDraft(
        custom && custom.length > 0 ? custom : DEFAULT_DRIVER_LIST_LABEL,
      );
      setDriverLabelModalVisible(true);
    },
    [bookingDriverLabels],
  );

  const closeDriverLabelEditor = useCallback(() => {
    setDriverLabelModalVisible(false);
    setEditingBookingUuid(null);
  }, []);

  const saveDriverLabelDraft = useCallback(async () => {
    if (!user?.id || !editingBookingUuid) {
      setDriverLabelModalVisible(false);
      setEditingBookingUuid(null);
      return;
    }
    const uuid = editingBookingUuid;
    const trimmed = driverLabelDraft.trim();
    const next = { ...bookingDriverLabels };
    if (trimmed.length === 0 || trimmed === DEFAULT_DRIVER_LIST_LABEL) {
      delete next[uuid];
    } else {
      next[uuid] = trimmed;
    }
    await saveBookingDriverLabels(user.id, next);
    setBookingDriverLabels(next);
    setDriverLabelModalVisible(false);
    setEditingBookingUuid(null);
  }, [driverLabelDraft, user?.id, editingBookingUuid, bookingDriverLabels]);

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
        const scheduledOn = scheduledOnForScope(scope);
        const bookingReference = debouncedBookingRefRef.current.trim() || undefined;
        const res = await bookingsApi.list(accessToken, {
          page: 1,
          pageSize:
            scheduledOn || bookingReference ? DATE_FILTER_PAGE_SIZE : PAGE_SIZE,
          timeScope: scope,
          scheduledOn,
          bookingReference,
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
            error: getAppUiMessage(e, 'Could not load bookings. Please try again.'),
            items: [],
            page: 0,
            total: 0,
            totalPages: 0,
            loadMoreError: null,
          },
        }));
      }
    },
    [accessToken, scheduledOnForScope],
  );

  useEffect(() => {
    void refreshScope(active);
  }, [filterDate, active, debouncedBookingRefQuery, refreshScope]);

  useEffect(() => {
    const id = setInterval(() => {
      const nextKey = currentListWindowKey();
      if (nextKey === currentWindowKeyRef.current) {
        return;
      }
      currentWindowKeyRef.current = nextKey;
      const scope = activeRef.current;
      if (scope === 'current' || scope === 'past') {
        void refreshScope(scope);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [refreshScope]);

  const loadNextPage = useCallback(
    async (scope: BookingListTimeScope) => {
      if (!accessToken || appendLockRef.current) {
        return;
      }
      const st = byScopeRef.current[scope];
      if (st.loading || st.loadingMore || st.items.length === 0) {
        return;
      }
      const hasMore =
        st.totalPages > 0
          ? st.page < st.totalPages
          : st.total > st.items.length;
      if (!hasMore) {
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
        const scheduledOn = scheduledOnForScope(scope);
        const bookingReference = debouncedBookingRefRef.current.trim() || undefined;
        const res = await bookingsApi.list(accessToken, {
          page: nextPage,
          pageSize:
            scheduledOn || bookingReference ? DATE_FILTER_PAGE_SIZE : PAGE_SIZE,
          timeScope: scope,
          scheduledOn,
          bookingReference,
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
              getAppUiMessage(e, 'Could not load more bookings. Please try again.'),
          },
        }));
      } finally {
        appendLockRef.current = false;
      }
    },
    [accessToken, scheduledOnForScope],
  );

  const scrollListTop = useCallback(() => {
    listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
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

  const runFullRefresh = useCallback(async () => {
    const scope = activeRef.current;
    await Promise.all([triggerViatorInboxRefresh(), refreshScope(scope)]);
    scrollListTop();
  }, [refreshScope, scrollListTop]);

  const onHeaderRefresh = useCallback(() => {
    setHeaderRefreshing(true);
    setRefreshing(true);
    void runFullRefresh().finally(() => {
      setHeaderRefreshing(false);
      setRefreshing(false);
    });
  }, [runFullRefresh]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderRefreshAndSignOut
          onRefresh={onHeaderRefresh}
          refreshing={headerRefreshing}
        />
      ),
    });
  }, [navigation, onHeaderRefresh, headerRefreshing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runFullRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [runFullRefresh]);

  const onEndReached = useCallback(() => {
    if (onEndReachedDuringMomentumRef.current) {
      return;
    }
    onEndReachedDuringMomentumRef.current = true;
    void loadNextPage(activeRef.current);
  }, [loadNextPage]);

  const onMomentumScrollBegin = useCallback(() => {
    onEndReachedDuringMomentumRef.current = false;
  }, []);

  const section = byScope[active];

  const canLoadMore =
    section.items.length > 0 &&
    !section.loading &&
    !section.loadingMore &&
    (section.totalPages > 0
      ? section.page < section.totalPages
      : section.total > section.items.length);

  const sections = useMemo((): Section[] => {
    const groups = new Map<string, Booking[]>();
    for (const b of section.items) {
      const k = bookingDayKeyFromIso(b.scheduledTime);
      if (!groups.has(k)) {
        groups.set(k, []);
      }
      groups.get(k)!.push(b);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === b) {
        return 0;
      }
      return active === 'past' ? (a < b ? 1 : -1) : a < b ? -1 : 1;
    });
    return keys.map((k) => ({
      title: formatSectionTitle(k),
      dayKey: k,
      data: groups.get(k)!,
    }));
  }, [section.items, active]);

  const emptyCopy = debouncedBookingRefQuery.trim()
    ? 'No bookings match that reference.'
    : active === 'past'
      ? 'No past trips yet.'
      : active === 'current'
        ? 'Nothing scheduled for today.'
        : 'No reservations from tomorrow onward.';
  const emptyIcon =
    active === 'past'
      ? 'archive'
      : active === 'current'
        ? 'calendar'
        : 'calendar';

  const onDeleteBooking = useCallback(
    (b: Booking) => {
      Alert.alert(
        'Delete booking',
        `Remove booking ${b.bookingReference}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (!accessToken) {
                return;
              }
              void (async () => {
                try {
                  await bookingsApi.removeReservation(accessToken, b.uuid);
                  await refreshScope(activeRef.current);
                } catch (e) {
                  Alert.alert(
                    'Cannot delete',
                    getAppUiMessage(e, 'This booking could not be removed. Please try again.'),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [accessToken, refreshScope],
  );

  const onCompleteBooking = useCallback(
    (b: Booking) => {
      Alert.alert(
        'Complete reservation',
        `Mark booking ${b.bookingReference} as completed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            style: 'default',
            onPress: () => {
              if (!accessToken) {
                return;
              }
              void (async () => {
                try {
                  await bookingsApi.complete(accessToken, b.uuid);
                  await refreshScope(activeRef.current);
                } catch (e) {
                  Alert.alert(
                    'Cannot complete',
                    getAppUiMessage(e, 'This booking could not be completed. Please try again.'),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [accessToken, refreshScope],
  );

  const onDatePickerChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setDatePickerVisible(false);
      if (event.type === 'dismissed') {
        return;
      }
    }
    if (selected) {
      setFilterDate(selected);
      if (Platform.OS === 'android') {
        void refreshScope(activeRef.current);
      }
    }
  }, [refreshScope]);

  const openBookingRefModal = useCallback(() => {
    setBookingRefDraft(bookingRefQuery);
    setBookingRefModalVisible(true);
  }, [bookingRefQuery]);

  const closeBookingRefModal = useCallback(() => {
    setBookingRefModalVisible(false);
  }, []);

  const applyBookingRefModal = useCallback(() => {
    setBookingRefQuery(bookingRefDraft);
    setBookingRefModalVisible(false);
  }, [bookingRefDraft]);

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.tabRow}>
        {TABS.map((tab, i) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active === tab.key }}
            onPress={() => selectTab(tab.key)}
            style={[
              styles.tabCell,
              i < TABS.length - 1 && styles.tabDivider,
              active === tab.key ? styles.tabCellActive : styles.tabCellIdle,
            ]}
          >
            <Text style={[styles.tabLabel, active === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Pressable
          onPress={openBookingRefModal}
          style={styles.searchTriggerInner}
          accessibilityRole="button"
          accessibilityLabel="Search by booking reference"
        >
          <Ionicons name="document-text" size={20} color="#616161" style={styles.searchIcon} />
          <Text
            numberOfLines={1}
            style={bookingRefQuery.trim() ? styles.searchDateValue : styles.searchDatePlaceholder}
          >
            {bookingRefQuery.trim() ? bookingRefQuery.trim() : 'Search by booking ref'}
          </Text>
        </Pressable>
        {bookingRefQuery.trim() ? (
          <Pressable onPress={() => setBookingRefQuery('')} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {active !== 'current' ? (
        <View style={styles.searchRow}>
          <Ionicons name="calendar" size={20} color="#616161" style={styles.searchIcon} />
          <Pressable style={styles.searchDateFlex} onPress={() => setDatePickerVisible(true)}>
            <Text style={filterDate ? styles.searchDateValue : styles.searchDatePlaceholder}>
              {filterDate ? formatFilterDateLabel(filterDate) : 'Search by date'}
            </Text>
          </Pressable>
          {filterDate ? (
            <Pressable
              onPress={() => {
                setFilterDate(null);
                setDatePickerVisible(false);
                void refreshScope(activeRef.current);
              }}
              hitSlop={8}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const listFooter =
    section.items.length > 0 && !section.loading ? (
      <View style={styles.footerWrap}>
        {section.total > 0 ? (
          <Text style={styles.footerMeta}>
            Showing {section.items.length} of {section.total} booking
            {section.total === 1 ? '' : 's'}
          </Text>
        ) : null}
        {canLoadMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more bookings"
            disabled={section.loadingMore}
            onPress={() => void loadNextPage(active)}
            style={({ pressed }) => [
              styles.loadMoreBtn,
              (pressed || section.loadingMore) && styles.pressed,
            ]}
          >
            {section.loadingMore ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loadMoreBtnText}>Load more</Text>
            )}
          </Pressable>
        ) : section.loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={brandBlue} />
          </View>
        ) : null}
        {section.loadMoreError ? (
          <Text style={styles.footerError}>{section.loadMoreError}</Text>
        ) : null}
      </View>
    ) : section.loadMoreError ? (
      <Text style={styles.footerError}>{section.loadMoreError}</Text>
    ) : null;

  const listPad = [styles.listPadBottom, { paddingBottom: spacing.lg + insets.bottom }];

  return (
    <Screen style={styles.flex}>
      {section.error && section.items.length === 0 && !section.loading ? (
        <View style={styles.errorWrap}>
          {listHeader}
          <Text style={styles.errorText}>{section.error}</Text>
        </View>
      ) : (
        <SectionList<Booking, Section>
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.uuid}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          contentContainerStyle={listPad}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandBlue} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          onMomentumScrollBegin={onMomentumScrollBegin}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            section.loading ? (
              <View style={styles.emptyLoading}>
                <ActivityIndicator size="large" color={brandBlue} />
              </View>
            ) : (
              <AnimatedEmptyList key={active} icon={emptyIcon} message={emptyCopy} />
            )
          }
          renderSectionHeader={({ section: sec }) => (
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{sec.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MyReservationsCard
              booking={item}
              driverListLabel={
                bookingDriverLabels[item.uuid]?.trim() || DEFAULT_DRIVER_LIST_LABEL
              }
              onPressDriverListLabel={() => openDriverLabelEditor(item.uuid)}
              onOpenDetail={() => navigation.navigate('BookingDetail', { uuid: item.uuid })}
              onEdit={() => navigation.navigate('EditReservation', { uuid: item.uuid })}
              onDelete={() => onDeleteBooking(item)}
              showCompleteButton={active === 'current'}
              onComplete={() => onCompleteBooking(item)}
            />
          )}
        />
      )}

      <Modal
        visible={driverLabelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDriverLabelEditor}
      >
        <TouchableWithoutFeedback onPress={closeDriverLabelEditor}>
          <View style={styles.driverLabelOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.driverLabelSheet}>
                <Text style={styles.driverLabelTitle}>Enter driver name</Text>
                <Text style={styles.driverLabelHint}>
                  Only this booking. Leave empty or save {DEFAULT_DRIVER_LIST_LABEL} to reset.
                </Text>
                <TextInput
                  value={driverLabelDraft}
                  onChangeText={setDriverLabelDraft}
                  placeholder={DEFAULT_DRIVER_LIST_LABEL}
                  placeholderTextColor="#9E9E9E"
                  style={styles.driverLabelInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={48}
                />
                <View style={styles.driverLabelActions}>
                  <Pressable
                    onPress={closeDriverLabelEditor}
                    style={({ pressed }) => [
                      styles.driverLabelBtnSecondary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.driverLabelBtnSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void saveDriverLabelDraft()}
                    style={({ pressed }) => [styles.driverLabelBtnPrimary, pressed && styles.pressed]}
                  >
                    <Text style={styles.driverLabelBtnPrimaryText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={bookingRefModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBookingRefModal}
      >
        <TouchableWithoutFeedback onPress={closeBookingRefModal}>
          <View style={styles.driverLabelOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.driverLabelSheet}>
                <Text style={styles.driverLabelTitle}>Search by booking ref</Text>
                <Text style={styles.driverLabelHint}>Tap Done to filter the list. Cancel discards changes.</Text>
                <TextInput
                  value={bookingRefDraft}
                  onChangeText={setBookingRefDraft}
                  placeholder="Booking reference"
                  placeholderTextColor="#9E9E9E"
                  style={styles.driverLabelInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <View style={styles.bookingRefModalActions}>
                  <View style={styles.bookingRefModalLeft}>
                    {bookingRefDraft.trim() ? (
                      <Pressable
                        onPress={() => setBookingRefDraft('')}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && styles.pressed]}
                      >
                        <Text style={styles.clearText}>Clear</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.driverLabelActions}>
                    <Pressable
                      onPress={closeBookingRefModal}
                      style={({ pressed }) => [
                        styles.driverLabelBtnSecondary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.driverLabelBtnSecondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={applyBookingRefModal}
                      style={({ pressed }) => [styles.driverLabelBtnPrimary, pressed && styles.pressed]}
                    >
                      <Text style={styles.driverLabelBtnPrimaryText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {datePickerVisible && active !== 'current' && (
        <>
          <DateTimePicker
            value={filterDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDatePickerChange}
          />
          {Platform.OS === 'ios' ? (
            <View style={styles.iosPickerBar}>
              <Pressable
                onPress={() => {
                  setDatePickerVisible(false);
                  void refreshScope(activeRef.current);
                }}
              >
                <Text style={styles.iosPickerDone}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBlock: {
    backgroundColor: '#FFFFFF',
    paddingBottom: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000000',
  },
  tabCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCellIdle: {
    backgroundColor: '#EEEEEE',
  },
  tabCellActive: {
    backgroundColor: '#000000',
  },
  tabDivider: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: '#000000',
    fontSize: 13,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchTriggerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  bookingRefModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bookingRefModalLeft: {
    minWidth: 56,
    justifyContent: 'center',
  },
  searchDateFlex: {
    flex: 1,
    paddingVertical: 4,
  },
  searchDateValue: {
    ...typography.body,
    color: '#212121',
  },
  searchDatePlaceholder: {
    ...typography.body,
    color: '#9E9E9E',
  },
  clearText: {
    color: brandBlue,
    fontWeight: '700',
    fontSize: 15,
  },
  dateHeader: {
    backgroundColor: '#757575',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginTop: 2,
  },
  dateHeaderText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  listPadBottom: {
    paddingHorizontal: spacing.sm,
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerMeta: {
    ...typography.caption,
    color: '#616161',
    textAlign: 'center',
  },
  loadMoreBtn: {
    minWidth: 160,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  emptyLoading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  errorWrap: { flex: 1 },
  errorText: {
    ...typography.body,
    color: colors.danger,
    padding: spacing.lg,
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
  driverLabelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  driverLabelSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.lg,
  },
  driverLabelTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    color: '#212121',
    marginBottom: spacing.xs,
  },
  driverLabelHint: {
    ...typography.caption,
    color: '#616161',
    marginBottom: spacing.md,
  },
  driverLabelInput: {
    ...typography.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: spacing.sm,
    color: '#212121',
    marginBottom: spacing.lg,
  },
  driverLabelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  driverLabelBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  driverLabelBtnSecondaryText: {
    ...typography.body,
    fontWeight: '600',
    color: '#616161',
  },
  driverLabelBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: brandBlue,
  },
  driverLabelBtnPrimaryText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
  },
});
