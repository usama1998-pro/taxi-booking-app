import { phoneForDisplay } from './phoneFormat';

export type ViatorBookingDetailRow = {
  label: string;
  value: string;
};

export type ViatorBookingInfo = {
  viatorReference?: string;
  pickupDateLabel?: string;
  subject?: string;
  receivedAt?: string;
  from?: string;
  productName?: string;
  leadTraveler?: string;
  travelerNames?: string;
  phone?: string;
  email?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  travelers?: string;
  language?: string;
  specialRequirements?: string;
  arrivalFlightNo?: string;
  arrivalTime?: string;
  arrivalAirline?: string;
  tourGrade?: string;
  emailText?: string;
  found?: boolean;
  message?: string;
};

function pushRow(
  rows: ViatorBookingDetailRow[],
  label: string,
  value: string | undefined,
): void {
  const v = value?.trim();
  if (v) {
    rows.push({ label, value: v });
  }
}

export function buildViatorBookingDetailRows(
  info: ViatorBookingInfo,
  footerLines: string[] = [],
): ViatorBookingDetailRow[] {
  const rows: ViatorBookingDetailRow[] = [];

  pushRow(rows, 'Reference', info.viatorReference);
  pushRow(rows, 'Date', info.pickupDateLabel);
  pushRow(rows, 'Tour', info.productName);
  pushRow(rows, 'Grade', info.tourGrade);
  pushRow(rows, 'Lead traveler', info.leadTraveler);
  if (info.travelerNames?.trim() && info.travelerNames !== info.leadTraveler) {
    pushRow(rows, 'All travelers', info.travelerNames);
  }
  pushRow(rows, 'Party size', info.travelers);
  pushRow(rows, 'Phone', info.phone);
  pushRow(rows, 'Pickup', info.pickupLocation);
  pushRow(rows, 'Drop-off', info.dropoffLocation);

  const flightParts = [
    info.arrivalAirline,
    info.arrivalFlightNo ? `flight ${info.arrivalFlightNo}` : undefined,
    info.arrivalTime,
  ].filter(Boolean);
  if (flightParts.length > 0) {
    pushRow(rows, 'Arrival', flightParts.join(' · '));
  }

  pushRow(rows, 'Language', info.language);
  pushRow(rows, 'Notes', info.specialRequirements);

  if (rows.length === 0 && info.message?.trim()) {
    pushRow(rows, 'Info', info.message);
  }

  for (const line of footerLines) {
    const t = line.trim();
    if (t) {
      rows.push({ label: '—', value: t });
    }
  }

  return rows;
}

export function formatViatorBookingAlertMessage(
  info: ViatorBookingInfo,
  footerLines: string[] = [],
): string {
  const rows = buildViatorBookingDetailRows(info, footerLines);
  if (rows.length === 0) {
    return 'No booking details available.';
  }
  return rows.map((r) => `${r.label}: ${r.value}`).join('\n');
}

export function formatViatorNotificationBody(info: ViatorBookingInfo): string {
  const parts: string[] = [];
  if (info.viatorReference && info.pickupDateLabel) {
    parts.push(`${info.viatorReference} — ${info.pickupDateLabel}`);
  }
  if (info.leadTraveler) {
    parts.push(info.leadTraveler);
  }
  if (info.pickupLocation) {
    parts.push(`Pickup: ${info.pickupLocation}`);
  }
  if (info.phone) {
    parts.push(phoneForDisplay(info.phone));
  }
  const body = parts.join(' · ');
  return body.length > 220 ? `${body.slice(0, 217)}…` : body;
}
