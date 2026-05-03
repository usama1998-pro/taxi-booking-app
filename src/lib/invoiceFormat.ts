import type { DriverInvoice, InvoiceAddressKind } from '../types/invoice';

export function formatInvoiceEndpoint(
  kind: InvoiceAddressKind,
  address: string | null,
  airline: string | null,
  flightNo: string | null,
): string {
  if (kind === 'LOCATION') {
    return (address ?? '').trim() || '—';
  }
  const a = (airline ?? '').trim();
  const f = (flightNo ?? '').trim();
  if (!a && !f) {
    return '—';
  }
  return [a, f].filter(Boolean).join(' · ');
}

export function formatInvoiceMoney(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function invoiceListSubtitle(inv: DriverInvoice): string {
  const d = new Date(inv.pickupDate);
  const date = Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
  let s = `${inv.bookingReference} · ${date} · ${formatInvoiceMoney(inv.totalAmount)}`;
  const seats = inv.childSeatsSummary?.trim();
  if (seats) {
    const short = seats.length > 44 ? `${seats.slice(0, 41)}…` : seats;
    s += ` · ${short}`;
  }
  return s;
}
