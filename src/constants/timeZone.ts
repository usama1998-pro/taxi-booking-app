import Constants from 'expo-constants';

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** Must match server `BOOKING_TZ` or `TZ` (see `get_booking_timezone()`). */
export const BOOKING_TIME_ZONE =
  firstNonEmpty(
    process.env.EXPO_PUBLIC_BOOKING_TIME_ZONE,
    Constants.expoConfig?.extra?.BOOKING_TIME_ZONE,
  ) || 'Europe/Madrid';
