import { BOOKING_TIME_ZONE } from '../constants/timeZone';

export function formatDateShort(
  iso: string,
  locale?: string,
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateOnly(
  iso: string,
  locale?: string,
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTimeOnly(
  iso: string,
  locale?: string,
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
