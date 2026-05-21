import type { ViatorNotification } from '../services/viator/viatorNotificationsApi';

/** #BR-TEST inbox imports (subject marker or API flag). */
export function isViatorTestNotification(
  notification: Pick<ViatorNotification, 'isTestBooking' | 'subject'>,
): boolean {
  if (notification.isTestBooking) {
    return true;
  }
  return /\(#[A-Z0-9-]*TEST\)/i.test(notification.subject);
}
