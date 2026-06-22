import type { Booking } from "../types/booking";
import type { InvoiceCreatePrefill } from "../types/invoice";

import {
  bookingChildSeatsSummary,
  bookingDropoffLabel,
  bookingPickupLabel,
} from "./bookingFormat";
import { phoneForDisplay } from "./phoneFormat";

import { parseWallClockFromIso } from "../utils/formatDate";

function scheduledLocalYmd(iso: string): string | null {
  const wall = parseWallClockFromIso(iso);
  if (wall) {
    return wall.dateYmd;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function splitFlight(val: string): { airline: string; flightNo: string } {
  const v = val.trim();
  const m = /^([A-Za-z]{2,3})[\s-]*(\d{1,4}[A-Za-z]?)$/.exec(v);
  if (m) {
    return { airline: m[1].toUpperCase(), flightNo: m[2] };
  }
  return { airline: "", flightNo: v };
}

function cleanLocationLabel(s: string): string {
  return s === "—" ? "" : s;
}

/**
 * Maps a loaded booking to new-invoice form defaults (customer, trip date, locations, price).
 */
export function bookingToInvoicePrefill(b: Booking): InvoiceCreatePrefill {
  const tripYmd = scheduledLocalYmd(b.scheduledTime) ?? "";
  const fullName = (
    b.customerName?.trim() ||
    b.user?.fullName?.trim() ||
    ""
  ).trim();
  const rawPhone = (
    b.customerPhone?.trim() ||
    b.user?.phone?.trim() ||
    ""
  ).trim();
  const phone = rawPhone ? phoneForDisplay(rawPhone) : "";
  const pickupAddr = cleanLocationLabel(bookingPickupLabel(b));
  const dropAddr = cleanLocationLabel(bookingDropoffLabel(b));
  const ref = b.bookingReference?.trim() ?? "";
  const seats = bookingChildSeatsSummary(b);
  const childSeatsSummary = seats ?? undefined;
  const passengerCount = Math.min(25, Math.max(1, b.passengerCount));

  if (b.flightNumber?.trim()) {
    const sp = splitFlight(b.flightNumber);
    // Bookings only store `flightNumber`; airline may be parsed or left blank (optional on invoice).
    return {
      fullName,
      phoneNumber: phone,
      bookingReference: ref,
      pickupDateYmd: tripYmd,
      priceText: String(b.price),
      pickupKind: "AIRPORT",
      pickupAirline: sp.airline,
      pickupFlightNo: sp.flightNo,
      dropoffKind: "LOCATION",
      dropoffAddress: dropAddr,
      passengerCount,
      childSeatsSummary,
    };
  }

  return {
    fullName,
    phoneNumber: phone,
    bookingReference: ref,
    pickupDateYmd: tripYmd,
    priceText: String(b.price),
    pickupKind: "LOCATION",
    pickupAddress: pickupAddr,
    dropoffKind: "LOCATION",
    dropoffAddress: dropAddr,
    passengerCount,
    childSeatsSummary,
  };
}
