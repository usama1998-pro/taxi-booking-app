import * as SecureStore from 'expo-secure-store';

const MAP_KEY_PREFIX = 'booking_driver_labels__';

function mapStorageKey(userId: string): string {
  return `${MAP_KEY_PREFIX}${userId}`;
}

export async function loadBookingDriverLabels(userId: string): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(mapStorageKey(userId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim().length > 0) {
        out[k] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveBookingDriverLabels(
  userId: string,
  map: Record<string, string>,
): Promise<void> {
  await SecureStore.setItemAsync(mapStorageKey(userId), JSON.stringify(map));
}
