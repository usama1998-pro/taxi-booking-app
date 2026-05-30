import {
  apiDelete,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
} from '../api/apiFetch';
import type {
  Booking,
  BookingCreateResponse,
  BookingListTimeScope,
  PaginatedBookings,
} from '../../types/booking';

export const bookingsApi = {
  create(body: Record<string, unknown>): Promise<BookingCreateResponse> {
    return apiPostJson<BookingCreateResponse>('/bookings', body);
  },

  list(
    token: string,
    params: {
      page?: number;
      pageSize?: number;
      timeScope?: BookingListTimeScope;
      /** Pickup calendar day in server TZ (`YYYY-MM-DD`). */
      scheduledOn?: string;
    } = {},
  ): Promise<PaginatedBookings> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (params.timeScope) {
      q.set('timeScope', params.timeScope);
    }
    if (params.scheduledOn) {
      q.set('scheduledOn', params.scheduledOn);
    }
    return apiGetJson<PaginatedBookings>(`/bookings?${q.toString()}`, token);
  },

  getByUuid(token: string, uuid: string): Promise<Booking> {
    return apiGetJson<Booking>(`/bookings/${uuid}`, token);
  },

  update(token: string, uuid: string, body: Record<string, unknown>): Promise<Booking> {
    return apiPatchJson<Booking>(`/bookings/${uuid}`, body, token);
  },

  complete(token: string, uuid: string): Promise<Booking> {
    return apiPatchJson<Booking>(`/bookings/${uuid}/complete`, {}, token);
  },

  remove(token: string, uuid: string): Promise<void> {
    return apiDelete(`/bookings/${uuid}`, token);
  },

  removeReservation(token: string, uuid: string): Promise<void> {
    return apiDelete(`/bookings/${uuid}/remove`, token);
  },
};
