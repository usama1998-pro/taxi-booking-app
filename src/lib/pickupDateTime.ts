export const PICKUP_IN_PAST_MESSAGE = 'Pickup must be now or in the future.';

const PAST_GRACE_MS = 60_000;

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
  const scheduled = combineDateAndTime(puDate, puTime);
  return scheduled.getTime() < now.getTime() - PAST_GRACE_MS;
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
