/** Pickup calendar day for Barcelona operations (matches backend `TZ`). */
export const BOOKING_TIME_ZONE = 'Europe/Madrid';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` in {@link BOOKING_TIME_ZONE} from a pickup instant. */
export function bookingDayKeyFromIso(iso: string): string {
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
