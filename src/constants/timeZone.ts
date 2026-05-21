import Constants from 'expo-constants';

/** Must match backend `TZ` / `getBookingTimeZone()` (default Europe/Madrid). */
export const BOOKING_TIME_ZONE =
  Constants.expoConfig?.extra?.BOOKING_TIME_ZONE?.trim() ||
  'Europe/Madrid';
