import Constants from 'expo-constants';

/** Must match server `BOOKING_TZ` or `TZ` (see `get_booking_timezone()`). */
export const BOOKING_TIME_ZONE =
  Constants.expoConfig?.extra?.BOOKING_TIME_ZONE?.trim() ||
  'Europe/Madrid';
