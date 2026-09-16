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

export function subscribeToUpdateEvents(listener: UpdateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyUpdateAvailable(info: UpdateInfo) {
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
 * 1. Checks EAS OTA cloud updates if available
 * 2. Queries the GitHub version.json endpoint for new APK releases
 */
export async function checkAppUpdates(): Promise<void> {
  // 1. First attempt silent OTA update via EAS Cloud if enabled
  try {
    if (!__DEV__ && Updates.isEnabled) {
      const otaUpdate = await Updates.checkForUpdateAsync();
      if (otaUpdate.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return;
      }
    }
  } catch (e) {
    // Silently continue to direct version endpoint
  }

  // 2. Direct in-app update check from version.json endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: UpdateInfo = await res.json();
      if (data.versionCode && data.versionCode > CURRENT_VERSION_CODE) {
        notifyUpdateAvailable(data);
      }
    }
  } catch (e) {
    // Silently ignore if offline or unreachable
  }
}
