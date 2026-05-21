import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useViatorNotifications } from '../../hooks/useViatorNotifications';

const POLL_MS = 60_000;

/** Polls Viator alerts and shows device notifications (no in-app banner). */
export function ViatorNotificationsListener() {
  const { refresh } = useViatorNotifications();

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  return null;
}
