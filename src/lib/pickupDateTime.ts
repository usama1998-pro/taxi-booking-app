import { BOOKING_TIME_ZONE } from '../constants/timeZone';
import { parseWallClockFromIso } from '../utils/formatDate';

export const PICKUP_IN_PAST_MESSAGE = 'Pickup must be now or in the future.';

const PAST_GRACE_MS = 60_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function zonedCalendarDayKey(d: Date, timeZone: string = BOOKING_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function startOfZonedDayWithKey(
  targetKey: string,
  hintMs: number,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  let lo = hintMs - 96 * 3_600_000;
  let hi = hintMs + 96 * 3_600_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const key = zonedCalendarDayKey(new Date(mid), timeZone);
    if (key < targetKey) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return new Date(lo);
}

function getZonedDateTimeParts(
  d: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(d)) {
    if (part.type !== 'literal') {
      map[part.type] = Number.parseInt(part.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
  };
}

/** Wall-clock date/time in {@link BOOKING_TIME_ZONE} → UTC instant. */
function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  const targetKey = `${year}-${pad2(month)}-${pad2(day)}`;
  let ms = startOfZonedDayWithKey(
    targetKey,
    Date.UTC(year, month - 1, day, 12),
    timeZone,
  ).getTime();

  for (let i = 0; i < 4; i += 1) {
    const parts = getZonedDateTimeParts(new Date(ms), timeZone);
    const wantMin = hour * 60 + minute;
    const haveMin = parts.hour * 60 + parts.minute;
    ms += (wantMin - haveMin) * 60_000;
  }

  return new Date(ms);
}

/** Picker calendar/time components are interpreted as Barcelona local time. */
export function combineBookingDateAndTimeToIso(datePart: Date, timePart: Date): string {
  return wallClockToUtc(
    datePart.getFullYear(),
    datePart.getMonth() + 1,
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes(),
  ).toISOString();
}

/** Populate date/time pickers from a stored pickup instant (Barcelona wall clock). */
export function bookingPickerDatesFromIso(iso: string): { date: Date; time: Date } {
  const wall = parseWallClockFromIso(iso);
  if (wall) {
    const [year, month, day] = wall.dateYmd.split('-').map((part) => Number.parseInt(part, 10));
    const [hour, minute] = wall.timeHm.split(':').map((part) => Number.parseInt(part, 10));
    const date = new Date(year, month - 1, day);
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return { date, time };
  }
  const { year, month, day, hour, minute } = getZonedDateTimeParts(new Date(iso));
  const date = new Date(year, month - 1, day);
  const time = new Date();
  time.setHours(hour, minute, 0, 0);
  return { date, time };
}

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const next = new Date(datePart);
  next.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return next;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPickupInPast(puDate: Date, puTime: Date, now = new Date()): boolean {
  const scheduledMs = Date.parse(combineBookingDateAndTimeToIso(puDate, puTime));
  return scheduledMs < now.getTime() - PAST_GRACE_MS;
}

/** Earliest selectable calendar day (start of today, local). */
export function minimumPickupDate(now = new Date()): Date {
  return startOfToday(now);
}

/** When pickup is today, time picker cannot go before now. */
export function minimumPickupTimeForDate(puDate: Date, now = new Date()): Date | undefined {
  if (!isSameCalendarDay(puDate, now)) {
    return undefined;
  }
  return now;
}

export function clampPickupSchedule(
  puDate: Date,
  puTime: Date,
  now = new Date(),
): { date: Date; time: Date } {
  const todayStart = startOfToday(now);
  let date = new Date(puDate);
  if (date < todayStart) {
    date = todayStart;
  }

  let time = new Date(puTime);
  if (isPickupInPast(date, time, now)) {
    time = new Date(now);
    time.setSeconds(0, 0);
  }

  return { date, time };
}
