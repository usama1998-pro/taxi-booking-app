import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';

import { buildApiUrl } from '../constants/config';
import { ApiRequestError, readResponseErrorMessage } from './apiErrors';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function appDisplayName(): string {
  return Constants.expoConfig?.name ?? 'This app';
}

/** User consent before we fetch the PDF or show the Android folder picker. */
function confirmSaveInvoicePdfToDevice(): Promise<boolean> {
  return new Promise((resolve) => {
    const androidNote =
      Platform.OS === 'android'
        ? ' On Android you will be asked to pick a folder (for example Downloads) where the file should be stored.'
        : '';
    Alert.alert(
      'Save PDF to this device?',
      `The invoice will be downloaded and saved on your phone.${androidNote}`,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Save', onPress: () => resolve(true) },
      ],
    );
  });
}

async function ensureInvoicesDir(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('On-device storage is not available.');
  }
  const dir = `${base}Invoices`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/** App sandbox: Documents/Invoices (visible in Files on iOS when file sharing is enabled). */
async function savePdfToAppDocuments(base64: string, filename: string): Promise<string> {
  const dir = await ensureInvoicesDir();
  const fileUri = `${dir}/${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const name = appDisplayName();
  if (Platform.OS === 'ios') {
    return `Open the Files app, then browse to On My iPhone → ${name} → Invoices.`;
  }
  return `Open your file manager or the Files app, find the “${name}” app folder, then open Invoices.`;
}

/** Android: user-picked folder via Storage Access Framework (Android 11+). */
async function trySavePdfAndroidSaf(
  base64: string,
  fileBaseName: string,
): Promise<'saved' | 'not_granted' | 'failed'> {
  try {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) {
      return 'not_granted';
    }
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      fileBaseName,
      'application/pdf',
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return 'saved';
  } catch {
    return 'failed';
  }
}

/**
 * Fetches the driver invoice PDF and saves it on the device (after user consent).
 * @returns Human-readable where to find the file, or `null` if the user declined consent.
 */
export async function downloadInvoicePdf(
  accessToken: string,
  invoiceId: string,
): Promise<string | null> {
  const agreed = await confirmSaveInvoicePdfToDevice();
  if (!agreed) {
    return null;
  }

  const path = `/drivers/me/invoices/${invoiceId}/pdf`;
  const url = buildApiUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    throw new ApiRequestError(raw || 'Network error', 0, path);
  }
  if (!res.ok) {
    const msg = await readResponseErrorMessage(res);
    throw new ApiRequestError(msg, res.status, path);
  }

  const filename = `invoice-${invoiceId.slice(0, 8)}.pdf`;
  const fileBaseName = `invoice-${invoiceId.slice(0, 8)}`;

  if (Platform.OS === 'web') {
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return 'If your browser did not prompt you, check your Downloads folder.';
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

  if (Platform.OS === 'android') {
    const saf = await trySavePdfAndroidSaf(base64, fileBaseName);
    if (saf === 'saved') {
      return 'The PDF was saved in the folder you selected.';
    }
    const hint = await savePdfToAppDocuments(base64, filename);
    if (saf === 'not_granted') {
      return `No folder was selected. ${hint}`;
    }
    return `Could not use the folder picker. ${hint}`;
  }

  return savePdfToAppDocuments(base64, filename);
}
