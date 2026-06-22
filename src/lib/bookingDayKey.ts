import { BOOKING_TIME_ZONE } from '../constants/timeZone';
import { parseWallClockFromIso } from '../utils/formatDate';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` from a pickup instant (wall-clock literal or timezone-aware). */
export function bookingDayKeyFromIso(iso: string): string {
  const wall = parseWallClockFromIso(iso);
  if (wall) {
    return wall.dateYmd;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** `YYYY-MM-DD` from a date-picker value (calendar components the user chose). */
export function bookingDayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Changes at local booking-timezone midnight; used to auto-refresh Current/Past tabs. */
export function currentListWindowKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
