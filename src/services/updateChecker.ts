import { Alert, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';

const VERSION_ENDPOINT = 'https://aminedrif.github.io/clicki-youtube/version.json';
const CURRENT_VERSION_CODE = 1;

export async function checkAppUpdates(): Promise<void> {
  // 1. First attempt silent OTA update via EAS Cloud
  try {
    if (!__DEV__) {
      const otaUpdate = await Updates.checkForUpdateAsync();
      if (otaUpdate.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return;
      }
    }
  } catch (e) {
    // Continue to standalone version check if OTA fails or offline
  }

  // 2. Fail-safe APK version check from GitHub endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(VERSION_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.versionCode && data.versionCode > CURRENT_VERSION_CODE) {
        Alert.alert(
          '🚀 New Update Available!',
          `Version ${data.version || 'New'} is now ready.\n\n${data.changelog || 'Performance improvements and bug fixes.'}`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Update Now',
              style: 'default',
              onPress: () => {
                if (data.downloadUrl) {
                  Linking.openURL(data.downloadUrl).catch(() => {});
                }
              },
            },
          ]
        );
      }
    }
  } catch (e) {
    // Silently ignore if offline
  }
}
