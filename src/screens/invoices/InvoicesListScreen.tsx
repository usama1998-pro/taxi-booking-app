import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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

import { AnimatedEmptyList, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { invoiceListSubtitle } from '../../lib/invoiceFormat';
import { logger } from '../../lib/logger';
import type { InvoicesStackParamList } from '../../navigation/types';
import { invoicesApi } from '../../services/invoices/invoicesApi';
import type { DriverInvoice } from '../../types/invoice';
import { colors, spacing, typography } from '../../theme';

const PAGE_SIZE = 20;

export function InvoicesListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<InvoicesStackParamList>>();
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<DriverInvoice>>(null);
  const appendLockRef = useRef(false);

  const [items, setItems] = useState<DriverInvoice[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);
  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  const itemsRef = useRef(items);
  pageRef.current = page;
  totalPagesRef.current = totalPages;
  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;
  itemsRef.current = items;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New invoice"
          onPress={() => navigation.navigate('InvoiceCreate', {})}
          style={styles.headerBtn}
          hitSlop={10}
        >
          <Text style={styles.headerBtnText}>＋ New</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const scrollListTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const refreshList = useCallback(async () => {
    if (!accessToken) {
      setError('Not signed in.');
      setItems([]);
      setPage(0);
      setTotalPages(0);
      setLoading(false);
      setLoadingMore(false);
      setLoadMoreError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    try {
      const res = await invoicesApi.list(accessToken, {
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setItems(res.data);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      logger.warn('InvoicesListScreen: fetch failed', e);
      setError(e instanceof Error ? e.message : 'Could not load invoices.');
      setItems([]);
      setPage(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accessToken]);

  const loadNextPage = useCallback(async () => {
    if (!accessToken || appendLockRef.current) {
      return;
    }
    const p = pageRef.current;
    const tp = totalPagesRef.current;
    if (loadingRef.current || loadingMoreRef.current || itemsRef.current.length === 0) {
      return;
    }
    if (tp > 0 && p >= tp) {
      return;
    }

    appendLockRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = p + 1;
      const res = await invoicesApi.list(accessToken, {
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const merged = [...prev];
        for (const row of res.data) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged;
      });
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      logger.warn('InvoicesListScreen: load more failed', e);
      setLoadMoreError(e instanceof Error ? e.message : 'Could not load more invoices.');
    } finally {
      setLoadingMore(false);
      appendLockRef.current = false;
    }
  }, [accessToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshList();
    scrollListTop();
    setRefreshing(false);
  }, [refreshList, scrollListTop]);

  useFocusEffect(
    useCallback(() => {
      void refreshList().then(scrollListTop);
    }, [refreshList, scrollListTop]),
  );

  const onEndReached = useCallback(() => {
    void loadNextPage();
  }, [loadNextPage]);

  const listPad = [styles.listPad, { paddingBottom: spacing.lg + insets.bottom }];

  const listFooter =
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    ) : loadMoreError ? (
      <Text style={styles.footerError}>{loadMoreError}</Text>
    ) : null;

  return (
    <Screen style={styles.flex}>
      <View style={styles.listArea}>
        {error && items.length === 0 ? (
          <View style={styles.pad}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : loading && items.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={listPad}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            ListFooterComponent={listFooter}
            ListEmptyComponent={
              <AnimatedEmptyList
                icon="document-text-outline"
                message='No invoices yet. Tap “＋ New” to create one.'
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('InvoiceDetail', { id: item.id })}
              >
                <Text style={styles.rowTitle}>{item.fullName}</Text>
                <Text style={styles.rowSub}>{invoiceListSubtitle(item)}</Text>
              </Pressable>
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
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { ...typography.subtitle, color: colors.primary },
  rowSub: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: spacing.xs,
  },
  headerBtn: { marginRight: spacing.sm, paddingVertical: spacing.xs },
  headerBtnText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});
