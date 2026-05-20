import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import {
  ensureNotificationPermissions,
  notifyNewViatorBooking,
  setViatorBadgeCount,
} from '../services/notifications/viatorLocalNotifications';
import {
  viatorNotificationsApi,
  type ViatorNotification,
} from '../services/viator/viatorNotificationsApi';

const POLL_MS = 60_000;

function mergeNotifications(
  prev: ViatorNotification[],
  fromServer: ViatorNotification[],
  dismissedIds: Set<string>,
): ViatorNotification[] {
  const map = new Map<string, ViatorNotification>();
  for (const n of prev) {
    if (!dismissedIds.has(n.id)) {
      map.set(n.id, n);
    }
  }
  for (const n of fromServer) {
    if (!dismissedIds.has(n.id)) {
      map.set(n.id, n);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

export function useViatorNotifications(options?: { enabled?: boolean }) {
  const { accessToken } = useAuth();
  const enabled = options?.enabled !== false && Boolean(accessToken);
  const [unread, setUnread] = useState<ViatorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);

  const knownIdsRef = useRef(new Set<string>());
  const dismissedIdsRef = useRef(new Set<string>());
  /** First inbox load: show in banner only, no push (avoids spam on app open). */
  const inboxSeededRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      inboxSeededRef.current = false;
      knownIdsRef.current.clear();
      dismissedIdsRef.current.clear();
      setNotificationsReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await ensureNotificationPermissions();
      if (!cancelled) {
        setNotificationsReady(ok);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const pushAlertsForNew = useCallback(async (list: ViatorNotification[]) => {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) {
      return;
    }

    if (!inboxSeededRef.current) {
      for (const n of list) {
        knownIdsRef.current.add(n.id);
      }
      inboxSeededRef.current = true;
      return;
    }

    for (const n of list) {
      if (knownIdsRef.current.has(n.id) || dismissedIdsRef.current.has(n.id)) {
        continue;
      }
      knownIdsRef.current.add(n.id);
      const sent = await notifyNewViatorBooking(n);
      if (!sent) {
        logger.warn('push alert not sent for', n.viatorReference);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      logger.debug('viator poll skip: no access token');
      setUnread([]);
      setUnreadCount(0);
      void setViatorBadgeCount(0);
      return;
    }
    const pollStartedAt = Date.now();
    logger.debug('viator poll start');
    setLoading(true);
    try {
      const syncResult = await viatorNotificationsApi.syncInbox(accessToken);
      logger.debug(
        `viator poll sync result: scanned=${syncResult.scanned}, added=${syncResult.added}`,
      );
      const list = await viatorNotificationsApi.list(accessToken, { limit: 10 });
      logger.debug(`viator poll list result: notifications=${list.length}`);
      let merged: ViatorNotification[] = [];
      setUnread((prev) => {
        merged = mergeNotifications(prev, list, dismissedIdsRef.current);
        setUnreadCount(merged.length);
        void setViatorBadgeCount(merged.length);
        return merged;
      });
      logger.debug(`viator poll merged unread: count=${merged.length}`);
      await pushAlertsForNew(merged);
      logger.debug(`viator poll complete in ${Date.now() - pollStartedAt}ms`);
    } catch (e) {
      logger.warn('useViatorNotifications: refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pushAlertsForNew]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!accessToken) {
        return;
      }
      dismissedIdsRef.current.add(id);
      knownIdsRef.current.add(id);
      setUnread((prev) => {
        const next = prev.filter((n) => n.id !== id);
        setUnreadCount(next.length);
        void setViatorBadgeCount(next.length);
        return next;
      });
      try {
        await viatorNotificationsApi.markRead(accessToken, id);
      } catch (e) {
        logger.warn('useViatorNotifications: dismiss failed', e);
      }
    },
    [accessToken],
  );

  const dismissAll = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setUnread((prev) => {
      for (const n of prev) {
        dismissedIdsRef.current.add(n.id);
        knownIdsRef.current.add(n.id);
      }
      setUnreadCount(0);
      void setViatorBadgeCount(0);
      return [];
    });
    try {
      await viatorNotificationsApi.markAllRead(accessToken);
    } catch (e) {
      logger.warn('useViatorNotifications: dismissAll failed', e);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    logger.debug(`viator polling enabled (intervalMs=${POLL_MS})`);
    void refresh();
    const timer = setInterval(() => {
      logger.debug('viator poll tick: interval');
      void refresh();
    }, POLL_MS);
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        logger.debug('viator poll tick: app became active');
        void refresh();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, refresh]);

  /** Re-poll after permission is granted (first poll often ran too early). */
  useEffect(() => {
    if (enabled && notificationsReady) {
      void refresh();
    }
  }, [enabled, notificationsReady, refresh]);

  return {
    unread,
    unreadCount,
    loading,
    notificationsReady,
    refresh,
    dismiss,
    dismissAll,
  };
}
