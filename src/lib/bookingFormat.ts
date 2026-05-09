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

export function bookingPickupLabel(b: Booking): string {
  return formatLocationJson(b.pickupLocation);
}

export function bookingDropoffLabel(b: Booking): string {
  return formatLocationJson(b.dropoffLocation);
}

/** "From :" line — label plus street/address when stored on JSON. */
export function bookingFromDisplay(b: Booking): string {
  const loc = b.pickupLocation;
  if (typeof loc === 'object' && loc !== null && !Array.isArray(loc)) {
    const o = loc as Record<string, unknown>;
    const label =
      (typeof o.label === 'string' && o.label) ||
      (typeof o.name === 'string' && o.name) ||
      (typeof o.formattedAddress === 'string' && o.formattedAddress);
    const extra =
      (typeof o.meetingAddress === 'string' && o.meetingAddress.trim()) ||
      (typeof o.address === 'string' && o.address.trim()) ||
      (typeof o.street === 'string' && o.street.trim());
    if (label && extra && !String(label).includes(extra)) {
      return `${label}, ${extra}`;
    }
    if (label) {
      return String(label);
    }
  }
  return bookingPickupLabel(b);
}

/** "To :" line */
export function bookingToDisplay(b: Booking): string {
  return bookingDropoffLabel(b);
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

/** App vs email booking heuristic for list icon. */
export function bookingSourceIcon(b: Booking): 'phone-portrait-outline' | 'mail-outline' {
  const email = (b.customerEmail || b.user?.email || '').toLowerCase();
  if (email.includes('@taxibarcelona24.guest')) {
    return 'phone-portrait-outline';
  }
  return 'mail-outline';
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
