import { Image } from 'expo-image';

import { logger } from './logger';

/**
 * Clears client-side caches so the next user/session does not reuse prior data.
 * Safe to call on sign-out even if some steps are unsupported (e.g. web).
 */
export async function clearAppCaches(): Promise<void> {
  try {
    await Image.clearMemoryCache();
  } catch (e) {
    logger.warn('clearAppCaches: memory cache', e);
  }
  try {
    await Image.clearDiskCache();
  } catch (e) {
    logger.warn('clearAppCaches: disk cache', e);
  }
}
