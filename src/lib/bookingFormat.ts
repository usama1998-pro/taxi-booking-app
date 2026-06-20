import type { Booking } from '../types/booking';

function formatLocationJson(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value || '—';
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const label =
      (typeof o.label === 'string' && o.label) ||
      (typeof o.address === 'string' && o.address) ||
      (typeof o.formattedAddress === 'string' && o.formattedAddress) ||
      (typeof o.name === 'string' && o.name);
    if (label) {
      return label;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Place name from pickup JSON (`label` / `name` only — matches backend storage). */
function pickupLocationNameOnly(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    const s = value.trim();
    return s || '—';
  }
  const o = readLocationJson(value);
  if (o) {
    const name =
      (typeof o.label === 'string' && o.label.trim()) ||
      (typeof o.name === 'string' && o.name.trim());
    if (name) {
      return name;
    }
  }
  return '—';
}

export function bookingPickupLabel(b: Booking): string {
  return pickupLocationNameOnly(b.pickupLocation);
}

export function bookingDropoffLabel(b: Booking): string {
  return formatLocationJson(b.dropoffLocation);
}

/** Pickup line for drivers — place name only (no meeting point / street suffix). */
export function bookingFromDisplay(b: Booking): string {
  return pickupLocationNameOnly(b.pickupLocation);
}

/** "To :" line — uses the stored drop-off label (including custom airport names). */
export function bookingToDisplay(b: Booking): string {
  return bookingDropoffLabel(b);
}

function readLocationJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

const SHORT_AIRPORT_LABEL = 'Barcelona Airport';
const LIST_LABEL_MAX = 48;
/** Collapse only default Barcelona BCN labels on list cards; keep driver-edited airport names. */
const KNOWN_BCN_LABEL = /^Barcelona[- ]?El Prat/i;
const AIRPORT_TEXT = /airport|aeropuerto|el\s+prat/i;

function locationJsonIsAirport(o: Record<string, unknown> | null): boolean {
  if (!o) {
    return false;
  }
  if (o.kind === 'airport') {
    return true;
  }
  const label =
    (typeof o.label === 'string' && o.label) ||
    (typeof o.address === 'string' && o.address) ||
    (typeof o.formattedAddress === 'string' && o.formattedAddress) ||
    '';
  return AIRPORT_TEXT.test(label);
}

function labelForListDisplay(text: string): string {
  const t = text.trim();
  if (!t || t === '—') {
    return t || '—';
  }
  if (KNOWN_BCN_LABEL.test(t)) {
    return SHORT_AIRPORT_LABEL;
  }
  if (t.length > LIST_LABEL_MAX) {
    return `${t.slice(0, LIST_LABEL_MAX - 1)}…`;
  }
  return t;
}

function locationDisplayForList(value: unknown, fullDisplay: string): string {
  const fromJson = formatLocationJson(value);
  const base = fromJson !== '—' ? fromJson : fullDisplay;
  return labelForListDisplay(base);
}

/** "From :" line on booking list cards (short airport label). */
export function bookingFromDisplayForList(b: Booking): string {
  return locationDisplayForList(b.pickupLocation, bookingFromDisplay(b));
}

/** "To :" line on booking list cards (short airport label). */
export function bookingToDisplayForList(b: Booking): string {
  return locationDisplayForList(b.dropoffLocation, bookingToDisplay(b));
}

/** Pickup is Barcelona airport (inbound flight / meet‑and‑greet fields on JSON). */
export function isPickupAirportBooking(b: Booking): boolean {
  const o = readLocationJson(b.pickupLocation);
  if (!o) {
    return false;
  }
  if (o.kind === 'airport') {
    return true;
  }
  return locationJsonIsAirport(o);
}

/** Drop-off is Barcelona airport (outbound flight fields on JSON). */
export function isDropoffAirportBooking(b: Booking): boolean {
  const o = readLocationJson(b.dropoffLocation);
  if (!o) {
    return false;
  }
  if (o.kind === 'airport') {
    return true;
  }
  return locationJsonIsAirport(o);
}

/** Airline on airport pickup JSON (`pickupLocation.airline`), when set. */
export function pickupArrivalAirline(b: Booking): string | null {
  const o = readLocationJson(b.pickupLocation);
  if (!isPickupAirportBooking(b)) {
    return null;
  }
  const a = o?.airline;
  return typeof a === 'string' && a.trim() ? a.trim() : null;
}

/** Flight on airport pickup JSON, else top-level `flightNumber` when set. */
export function pickupArrivalFlight(b: Booking): string | null {
  const o = readLocationJson(b.pickupLocation);
  if (isPickupAirportBooking(b)) {
    const f = o?.flight;
    if (typeof f === 'string' && f.trim()) {
      return f.trim();
    }
  }
  const fn = b.flightNumber?.trim();
  return fn || null;
}

export function bookingReturnTimeIso(b: Booking): string | null {
  const raw = b.returnTime;
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s || null;
  }
  try {
    const d = new Date(raw as string | number);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function bookingHasReturnTrip(b: Booking): boolean {
  return Boolean(bookingReturnTimeIso(b));
}

export type DropoffReturnFlightInfo = {
  airline: string | null;
  flight: string | null;
  returnTimeIso: string | null;
  /** Raw departure time on dropoff JSON (Viator email), when `returnTime` was not stored. */
  departureTimeLabel: string | null;
  /** Travel-day ISO used when `returnTime` is missing (usually same day as pickup). */
  departureDateIso: string | null;
};

/**
 * Return / outbound leg at airport (dropoff JSON + `returnTime`), when driver captured them.
 */
export function dropoffReturnFlightInfo(b: Booking): DropoffReturnFlightInfo | null {
  const o = readLocationJson(b.dropoffLocation);
  const airline =
    typeof o?.airline === 'string' && o.airline.trim() ? o.airline.trim() : null;
  let flight = typeof o?.flight === 'string' && o.flight.trim() ? o.flight.trim() : null;
  if (!flight && isDropoffAirportBooking(b)) {
    flight = b.flightNumber?.trim() || null;
  }
  const returnTimeIso = bookingReturnTimeIso(b);
  const isViator = isViatorEmailBooking(b);
  const departureTimeLabel =
    !isViator &&
    typeof o?.departureTime === 'string' &&
    o.departureTime.trim()
      ? o.departureTime.trim()
      : null;
  const departureDateIso =
    returnTimeIso ??
    (!isViator && isDropoffAirportBooking(b) && b.scheduledTime?.trim()
      ? b.scheduledTime.trim()
      : null);
  if (!airline && !flight && !returnTimeIso && !departureTimeLabel && !departureDateIso) {
    return null;
  }
  return { airline, flight, returnTimeIso, departureTimeLabel, departureDateIso };
}

export type DropoffDepartureDisplay = {
  dateIso: string | null;
  timeIso: string | null;
  timeLabel: string | null;
};

/** Departure date/time for airport drop-off rows on the driver detail screen. */
export function dropoffDepartureDisplay(b: Booking): DropoffDepartureDisplay | null {
  if (isViatorEmailBooking(b)) {
    return null;
  }
  if (!isDropoffAirportBooking(b)) {
    return null;
  }
  const info = dropoffReturnFlightInfo(b);
  if (!info) {
    return null;
  }
  return {
    dateIso: info.returnTimeIso ?? info.departureDateIso,
    timeIso: info.returnTimeIso,
    timeLabel: info.returnTimeIso ? null : info.departureTimeLabel,
  };
}

export type BookingFlightLine = { flight: string; airline?: string };

export function bookingFlightLine(b: Booking): BookingFlightLine | null {
  const loc = b.pickupLocation;
  if (typeof loc === 'object' && loc !== null && !Array.isArray(loc)) {
    const o = loc as Record<string, unknown>;
    const airline = typeof o.airline === 'string' ? o.airline.trim() : '';
    const flight = typeof o.flight === 'string' ? o.flight.trim() : '';
    if (airline || flight) {
      return { flight: flight || '—', airline: airline || undefined };
    }
  }
  const fn = b.flightNumber?.trim();
  if (fn) {
    return { flight: fn };
  }
  return null;
}

function guestAppEmail(email: string): boolean {
  return email.startsWith('guest.') && email.endsWith('@taxibarcelona24.guest');
}

/** Reservation created in the mobile app (guest email from phone). */
export function isAppBooking(b: Booking): boolean {
  const email = (b.customerEmail || b.user?.email || '').toLowerCase();
  return guestAppEmail(email);
}

/** Reservation imported from a Viator booking email (BR- reference or tagged note). */
export function isViatorEmailBooking(b: Booking): boolean {
  const email = (b.customerEmail || b.user?.email || '').toLowerCase();
  if (guestAppEmail(email)) {
    return false;
  }
  if (email.startsWith('viator.')) {
    return true;
  }
  const note = (b.note ?? '').trim();
  if (note.startsWith('[Viator')) {
    return true;
  }
  const ref = (b.bookingReference ?? '').trim().toUpperCase();
  return ref.startsWith('BR-');
}

/** Reservation submitted via the public website (real customer email). */
export function isWebsiteBooking(b: Booking): boolean {
  return !isViatorEmailBooking(b) && !isAppBooking(b);
}

export type BookingSourceIcon = 'mail' | 'phone-portrait' | 'globe';

/** Viator email vs app vs website icon on list cards. */
export function bookingSourceIcon(b: Booking): BookingSourceIcon {
  if (isViatorEmailBooking(b)) {
    return 'mail';
  }
  if (isAppBooking(b)) {
    return 'phone-portrait';
  }
  return 'globe';
}

export function bookingSourceAccessibilityLabel(b: Booking): string {
  if (isViatorEmailBooking(b)) {
    return 'Viator email booking';
  }
  if (isAppBooking(b)) {
    return 'App booking';
  }
  return 'Website booking';
}

/** List card tint per booking source. */
export function bookingSourceIconColor(b: Booking): string {
  if (isViatorEmailBooking(b)) {
    return '#1E88E5';
  }
  if (isAppBooking(b)) {
    return '#43A047';
  }
  return '#F57C00';
}

/** Header + section bar color on the booking detail screen. */
export function bookingDetailAccentColor(b: Booking): string {
  if (isAppBooking(b)) {
    return '#43A047';
  }
  if (isViatorEmailBooking(b)) {
    return '#1E88E5';
  }
  if (isWebsiteBooking(b)) {
    return '#F57C00';
  }
  return '#2196F3';
}

export function bookingPassengerLabel(b: Booking): string {
  return (
    b.customerName?.trim() ||
    b.user?.fullName?.trim() ||
    b.customerEmail ||
    b.user?.email ||
    'Passenger'
  );
}

/** Human-readable child seat request for drivers and summaries. */
export function bookingChildSeatsSummary(b: Booking): string | null {
  if (!isWebsiteBooking(b)) {
    return null;
  }
  const infant = b.infantCarrierCount ?? 0;
  const child = b.childSeatCount ?? 0;
  const booster = b.boosterCount ?? 0;
  if (infant === 0 && child === 0 && booster === 0) {
    return null;
  }
  const parts: string[] = [];
  if (infant > 0) {
    parts.push(`${infant} infant carrier${infant === 1 ? '' : 's'}`);
  }
  if (child > 0) {
    parts.push(`${child} child seat${child === 1 ? '' : 's'}`);
  }
  if (booster > 0) {
    parts.push(`${booster} booster${booster === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
