export type InvoiceAddressKind = 'LOCATION' | 'AIRPORT';

export type DriverInvoice = {
  id: string;
  driverId: string;
  fullName: string;
  phoneNumber: string;
  bookingReference: string;
  pickupDate: string;
  pickupKind: InvoiceAddressKind;
  pickupAddress: string | null;
  pickupAirline: string | null;
  pickupFlightNo: string | null;
  dropoffKind: InvoiceAddressKind;
  dropoffAddress: string | null;
  dropoffAirline: string | null;
  dropoffFlightNo: string | null;
  priceAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  sourceBookingUuid: string | null;
  passengerCount: number;
  childSeatsSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedInvoices = {
  data: DriverInvoice[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InvoiceDayBucket = {
  date: string;
  total: number;
  count: number;
};

export type InvoiceMonthBucket = {
  month: string;
  total: number;
  subtotal: number;
  count: number;
};

export type DriverInvoiceAnalytics = {
  count: number;
  sums: { subtotal: number; tax: number; total: number };
  averageInvoiceTotal: number;
  linkedFromBookingCount: number;
  last7Days: InvoiceDayBucket[];
  last6Months: InvoiceMonthBucket[];
};

/** Route params → New invoice screen: seed fields from a booking. */
export type InvoiceCreatePrefill = {
  fullName: string;
  phoneNumber: string;
  bookingReference: string;
  pickupDateYmd: string;
  priceText: string;
  pickupKind: InvoiceAddressKind;
  pickupAddress?: string;
  pickupAirline?: string;
  pickupFlightNo?: string;
  dropoffKind: InvoiceAddressKind;
  dropoffAddress?: string;
  dropoffAirline?: string;
  dropoffFlightNo?: string;
  /** Prefilled from booking when passenger requested child seats. */
  childSeatsSummary?: string;
};

export type CreateDriverInvoiceInput = {
  fullName: string;
  phoneNumber: string;
  bookingReference: string;
  pickupDate: string;
  pickupKind: InvoiceAddressKind;
  pickupAddress?: string;
  pickupAirline?: string;
  pickupFlightNo?: string;
  dropoffKind: InvoiceAddressKind;
  dropoffAddress?: string;
  dropoffAirline?: string;
  dropoffFlightNo?: string;
  priceAmount: number;
  passengerCount: number;
  /** Sent to API; optional. Server fills from linked booking when omitted and reference matches. */
  childSeatsSummary?: string;
};
