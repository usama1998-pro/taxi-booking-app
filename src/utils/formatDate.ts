import { BOOKING_TIME_ZONE } from '../constants/timeZone';

const WALL_CLOCK_ISO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;
const HAS_TIMEZONE_OFFSET_RE = /[zZ]|[+-]\d{2}:\d{2}$/;

/** Literal wall-clock date/time from API (`YYYY-MM-DDTHH:mm` without offset). */
export function parseWallClockFromIso(
  iso: string,
): { dateYmd: string; timeHm: string } | null {
  const trimmed = iso.trim();
  if (HAS_TIMEZONE_OFFSET_RE.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(WALL_CLOCK_ISO_RE);
  if (!match) {
    return null;
  }
  return { dateYmd: match[1], timeHm: `${match[2]}:${match[3]}` };
}

export function formatBookingWallClockTime(iso: string): string | null {
  return parseWallClockFromIso(iso)?.timeHm ?? null;
}

export function formatBookingWallClockDate(
  iso: string,
  locale?: string,
): string | null {
  const wall = parseWallClockFromIso(iso);
  if (!wall) {
    return null;
  }
  try {
    const [year, month, day] = wall.dateYmd.split('-').map((part) => Number.parseInt(part, 10));
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  } catch {
    return wall.dateYmd;
  }
}

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
  const wallClock = formatBookingWallClockTime(iso);
  if (wallClock) {
    return wallClock;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
