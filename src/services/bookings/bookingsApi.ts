import { API_BASE_URL } from '../../constants/config';
import { logger } from '../../lib/logger';
import type { Booking, BookingListTimeScope, PaginatedBookings } from '../../types/booking';

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: unknown };
    if (Array.isArray(j.message)) {
      return j.message.map(String).join('\n');
    }
    if (typeof j.message === 'string') {
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return text.trim() || `Request failed (${res.status})`;
}

async function authorizedJson<T>(path: string, token: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  logger.debug('Bookings API', path);
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    logger.warn('Bookings API error', { path, status: res.status, msg });
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const bookingsApi = {
  list(
    token: string,
    params: {
      page?: number;
      pageSize?: number;
      timeScope?: BookingListTimeScope;
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
    return authorizedJson<PaginatedBookings>(`/bookings?${q.toString()}`, token);
  },

  getByUuid(token: string, uuid: string): Promise<Booking> {
    return authorizedJson<Booking>(`/bookings/${uuid}`, token);
  },
};
