import { api } from '../api';
import type { ViatorBookingInfo } from '../../lib/formatViatorBooking';

export type ViatorNotification = {
  id: string;
  subject: string;
  viatorReference: string;
  pickupDateLabel: string;
  receivedAt: string;
  /** True for #BR-TEST inbox imports. */
  isTestBooking?: boolean;
} & ViatorBookingInfo;

export const viatorNotificationsApi = {
  list(
    accessToken: string,
    options?: { limit?: number },
  ): Promise<ViatorNotification[]> {
    const params = new URLSearchParams();
    if (options?.limit != null) {
      params.set('limit', String(options.limit));
    }
    const q = params.toString();
    return api.get<ViatorNotification[]>(
      `/viator/notifications${q ? `?${q}` : ''}`,
      accessToken,
    );
  },

  unreadCount(accessToken: string): Promise<number> {
    return api
      .get<{ count: number }>('/viator/notifications/unread-count', accessToken)
      .then((res) => res.count ?? 0);
  },

  markRead(accessToken: string, id: string): Promise<ViatorNotification> {
    return api.patch<ViatorNotification>(
      `/viator/notifications/${id}/read`,
      {},
      accessToken,
    );
  },

  markAllRead(accessToken: string): Promise<{ updated: number }> {
    return api.patch<{ updated: number }>(
      '/viator/notifications/read-all',
      {},
      accessToken,
    );
  },
};
