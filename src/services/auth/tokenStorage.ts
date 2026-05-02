import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'taxi_driver_access_token';

export async function getStoredAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearStoredAccessToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    /* already removed */
  }
}
