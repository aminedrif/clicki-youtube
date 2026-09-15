import { Platform } from 'react-native';

// Google AdMob Production & Test Ad Unit IDs
export const ADMOB_PROD_UNITS = {
  interstitial: Platform.select({
    ios: 'ca-app-pub-4277035637966209/9253050311',
    android: 'ca-app-pub-4277035637966209/9253050311',
    default: 'ca-app-pub-4277035637966209/9253050311',
  }),
  banner: Platform.select({
    ios: 'ca-app-pub-4277035637966209/9253050311',
    android: 'ca-app-pub-4277035637966209/9253050311',
    default: 'ca-app-pub-4277035637966209/9253050311',
  }),
};

export const ADMOB_TEST_UNITS = {
  interstitial: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }),
  rewarded: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }),
};

let interstitialInstance: any = null;
let isInterstitialLoaded = false;
let adsEnabled = true;

export function setAdsEnabled(enabled: boolean) {
  adsEnabled = enabled;
}

export function areAdsEnabled(): boolean {
  return adsEnabled;
}

export function initAdMob() {
  if (!adsEnabled) return;

  try {
    // 1. Detect Expo Go environment reliably without evaluating native modules
    const isExpoGo = Boolean((globalThis as any)?.expo?.modules?.ExpoGo);

    if (isExpoGo) {
      // Running in Expo Go (custom native modules like AdMob are not bundled in Expo Go binary)
      return;
    }

    const { NativeModules, TurboModuleRegistry } = require('react-native');
    const hasTurboModule = TurboModuleRegistry?.get ? TurboModuleRegistry.get('RNGoogleMobileAdsModule') : null;
    const hasNativeModule = NativeModules?.RNGoogleMobileAdsModule;

    if (!hasTurboModule && !hasNativeModule) {
      return;
    }

    const GoogleMobileAds = require('react-native-google-mobile-ads');
    const { InterstitialAd, AdEventType, TestIds } = GoogleMobileAds;

    const adUnitId = __DEV__
      ? TestIds.INTERSTITIAL
      : (ADMOB_PROD_UNITS.interstitial || ADMOB_TEST_UNITS.interstitial || TestIds.INTERSTITIAL);

    interstitialInstance = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialInstance.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialInstance.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      interstitialInstance.load();
    });

    interstitialInstance.addAdEventListener(AdEventType.ERROR, (error: any) => {
      isInterstitialLoaded = false;
      console.log('AdMob Interstitial failed to load:', error);
    });

    interstitialInstance.load();
  } catch (e) {
    // Graceful fallback for non-native development
  }
}

export function showInterstitialOnDownloadComplete(): Promise<boolean> {
  if (!adsEnabled) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      if (interstitialInstance && isInterstitialLoaded) {
        interstitialInstance.show();
        resolve(true);
      } else {
        if (interstitialInstance) {
          interstitialInstance.load();
        }
        resolve(false);
      }
    } catch (e) {
      resolve(false);
    }
  });
}
