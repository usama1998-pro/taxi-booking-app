export type BookingUserSummary = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
};

export type BookingDriverSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
} | null;

/** API payload: no internal `id`; use `uuid` for URLs only. */
export type Booking = {
  uuid: string;
  bookingReference: string;
  userId: string;
  driverId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  flightNumber: string | null;
  returnTime: string | null;
  pickupLocation: unknown;
  dropoffLocation: unknown;
  scheduledTime: string;
  price: number;
  status: string;
  luggageCount: number;
  passengerCount: number;
  infantCarrierCount: number;
  childSeatCount: number;
  boosterCount: number;
  note: string | null;
  createdAt: string;
  /** Present when status is `completed`; used for past-list ordering on the server. */
  completedAt?: string | null;
  user: BookingUserSummary;
  driver: BookingDriverSummary;
};

export type PaginatedBookings = {
  data: Booking[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Matches backend `GET /bookings?timeScope=` */
export type BookingListTimeScope = 'past' | 'current' | 'upcoming';

/** Draft / local-only booking model (not the API row shape). */
export type BookingStatus =
  | 'draft'
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  addressLabel?: string;
}

export interface BookingDraft {
  id: string;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  status: BookingStatus;
  scheduledAt?: string;
  createdAt: string;
}
