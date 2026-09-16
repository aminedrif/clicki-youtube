import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export const VERSION_ENDPOINT = 'https://aminedrif.github.io/clicki-youtube/version.json';
export const CURRENT_VERSION_CODE = 1;
export const CURRENT_VERSION_NAME = '1.0.0';

export interface UpdateInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  changelog?: string;
  forceUpdate?: boolean;
}

type UpdateListener = (info: UpdateInfo) => void;
const listeners: Set<UpdateListener> = new Set();
let cachedUpdateInfo: UpdateInfo | null = null;

export function subscribeToUpdateEvents(listener: UpdateListener): () => void {
  listeners.add(listener);
  // If we already detected an update, immediately trigger the listener
  if (cachedUpdateInfo) {
    try {
      listener(cachedUpdateInfo);
    } catch {}
  }
  return () => {
    listeners.delete(listener);
  };
}

function notifyUpdateAvailable(info: UpdateInfo) {
  cachedUpdateInfo = info;
  listeners.forEach((callback) => {
    try {
      callback(info);
    } catch (err) {
      console.warn('Update listener error:', err);
    }
  });
}

/**
 * Checks for updates:
 * 1. Queries the GitHub version.json endpoint for new APK releases
 * 2. Attempts EAS OTA cloud updates in the background if enabled
 */
export async function checkAppUpdates(): Promise<void> {
  // 1. Direct in-app update check from version.json endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: UpdateInfo = await res.json();
      if (data.versionCode && data.versionCode > CURRENT_VERSION_CODE) {
        notifyUpdateAvailable(data);
        return;
      }
    }
  } catch (e) {
    // Continue to EAS check if offline or error
  }

  // 2. EAS OTA cloud check (background)
  try {
    if (!__DEV__ && Updates.isEnabled) {
      const otaUpdate = await Updates.checkForUpdateAsync();
      if (otaUpdate.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    }
  } catch (e) {
    // Silently ignore
  }
}
