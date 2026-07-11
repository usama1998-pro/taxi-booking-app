/**
 * Lightweight cross-screen signal for booking mutations.
 *
 * Screens that edit a booking (edit reservation, mark complete, start ride)
 * record the affected uuid here. The bookings list consumes these on focus and
 * refreshes just those rows in place, so the list reflects changes without
 * resetting pagination or the current scroll position.
 */
const pendingMutatedUuids = new Set<string>();

export function markBookingMutated(uuid: string | null | undefined): void {
  if (uuid) {
    pendingMutatedUuids.add(uuid);
  }
}

/** Returns and clears the set of booking uuids changed since the last call. */
export function consumePendingBookingMutations(): string[] {
  if (pendingMutatedUuids.size === 0) {
    return [];
  }
  const uuids = [...pendingMutatedUuids];
  pendingMutatedUuids.clear();
  return uuids;
}
