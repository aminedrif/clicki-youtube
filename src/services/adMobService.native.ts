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
    const mobileAds = GoogleMobileAds.default;
    const { InterstitialAd, AdEventType, TestIds } = GoogleMobileAds;

    // Configure test devices including user's connected Samsung Galaxy A53
    mobileAds()
      .setRequestConfiguration({
        testDeviceIdentifiers: ['6D52958B4338F70A48490A43881E314C', 'EMULATOR'],
      })
      .catch(() => {});

    mobileAds()
      .initialize()
      .catch(() => {});

    const prodAdUnitId = ADMOB_PROD_UNITS.interstitial;
    const testAdUnitId = ADMOB_TEST_UNITS.interstitial || TestIds.INTERSTITIAL;
    const primaryAdUnit = __DEV__ ? testAdUnitId : (prodAdUnitId || testAdUnitId);

    const setupAdInstance = (unitId: string, isFallback = false) => {
      try {
        const instance = InterstitialAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        instance.addAdEventListener(AdEventType.LOADED, () => {
          isInterstitialLoaded = true;
          interstitialInstance = instance;
        });

        instance.addAdEventListener(AdEventType.CLOSED, () => {
          isInterstitialLoaded = false;
          instance.load();
        });

        instance.addAdEventListener(AdEventType.ERROR, (error: any) => {
          isInterstitialLoaded = false;
          console.log(`AdMob Interstitial (${unitId}) failed to load:`, error);
          // If production ad unit fails (e.g. ad format mismatch or account pending), fallback to test ad unit
          if (!isFallback && unitId !== testAdUnitId) {
            console.log('Falling back to test Interstitial ad unit...');
            setupAdInstance(testAdUnitId, true);
          }
        });

        instance.load();
        interstitialInstance = instance;
      } catch (e) {
        console.log('Error creating InterstitialAd instance:', e);
      }
    };

    setupAdInstance(primaryAdUnit);
  } catch (e) {
    // Graceful fallback for non-native development
  }
}

let hasShownDownloadAdThisSession = false;

export function showInterstitialOnDownloadClick(): Promise<boolean> {
  if (!adsEnabled) return Promise.resolve(false);
  if (hasShownDownloadAdThisSession) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      if (interstitialInstance && isInterstitialLoaded) {
        hasShownDownloadAdThisSession = true;
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
