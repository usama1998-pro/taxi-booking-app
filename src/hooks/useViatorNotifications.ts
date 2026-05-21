import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { isViatorTestNotification } from '../lib/isViatorTestNotification';
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

  const knownIdsRef = useRef(new Set<string>());
  const dismissedIdsRef = useRef(new Set<string>());
  const sessionStartedAtRef = useRef(Date.now());
  const inboxSeededRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      inboxSeededRef.current = false;
      sessionStartedAtRef.current = Date.now();
      knownIdsRef.current.clear();
      dismissedIdsRef.current.clear();
      setUnread([]);
      setUnreadCount(0);
      void setViatorBadgeCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void ensureNotificationPermissions();
  }, [enabled]);

  const pushAlertsForNew = useCallback(async (list: ViatorNotification[]) => {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) {
      return;
    }

    const catchUpCutoff = sessionStartedAtRef.current - 15_000;

    for (const n of list) {
      if (knownIdsRef.current.has(n.id) || dismissedIdsRef.current.has(n.id)) {
        continue;
      }
      knownIdsRef.current.add(n.id);

      const receivedMs = new Date(n.receivedAt).getTime();
      const isTest = isViatorTestNotification(n);
      const isCatchUp =
        !inboxSeededRef.current && receivedMs < catchUpCutoff && !isTest;
      if (isCatchUp) {
        continue;
      }

      const sent = await notifyNewViatorBooking({ ...n, isTestBooking: isTest });
      if (!sent) {
        logger.warn('local notification not sent for', n.viatorReference);
      }
    }

    inboxSeededRef.current = true;
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setUnread([]);
      setUnreadCount(0);
      void setViatorBadgeCount(0);
      return;
    }
    setLoading(true);
    try {
      const list = await viatorNotificationsApi.list(accessToken, { limit: 10 });
      let merged: ViatorNotification[] = [];
      setUnread((prev) => {
        merged = mergeNotifications(prev, list, dismissedIdsRef.current);
        setUnreadCount(merged.length);
        void setViatorBadgeCount(merged.length);
        return merged;
      });
      await pushAlertsForNew(merged);
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

  return {
    unread,
    unreadCount,
    loading,
    refresh,
    dismiss,
    dismissAll,
  };
}
