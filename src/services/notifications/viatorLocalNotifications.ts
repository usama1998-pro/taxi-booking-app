import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  formatViatorNotificationBody,
  type ViatorBookingInfo,
} from '../../lib/formatViatorBooking';
import { logger } from '../../lib/logger';

const ANDROID_CHANNEL_ID = 'viator-bookings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let androidChannelReady = false;

export async function setupViatorNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Viator bookings',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1E88E5',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  androidChannelReady = true;
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  await setupViatorNotificationChannel();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
    android: {},
  });

  if (!requested.granted) {
    logger.warn('Notification permission not granted', requested);
  }
  return requested.granted;
}

function buildContent(item: {
  viatorReference: string;
  pickupDateLabel: string;
}): Notifications.NotificationContentInput {
  return {
    title: 'New Viator booking',
    body: `${item.viatorReference} — ${item.pickupDateLabel}`,
    data: {
      viatorReference: item.viatorReference,
      type: 'viator-booking',
    },
    sound: 'default',
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
  };
}

export async function notifyNewViatorBooking(
  item: ViatorBookingInfo & {
    viatorReference: string;
    pickupDateLabel: string;
  },
): Promise<boolean> {
  try {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) {
      return false;
    }

    await setupViatorNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      content: buildContent(item),
      trigger: null,
    });
    return true;
  } catch (e) {
    logger.warn('notifyNewViatorBooking failed', e);
    return false;
  }
}

export async function setViatorBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badge not supported on all platforms / launchers
  }
}
