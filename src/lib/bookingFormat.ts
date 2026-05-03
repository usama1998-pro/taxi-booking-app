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
