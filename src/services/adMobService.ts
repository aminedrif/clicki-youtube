export const ADMOB_PROD_UNITS = {
  interstitial: 'ca-app-pub-4277035637966209/9253050311',
  banner: 'ca-app-pub-4277035637966209/9253050311',
};

export const ADMOB_TEST_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

let adsEnabled = true;

export function setAdsEnabled(enabled: boolean) {
  adsEnabled = enabled;
}

export function areAdsEnabled(): boolean {
  return adsEnabled;
}

export function initAdMob() {
  // No-op on web
}

export function showInterstitialOnDownloadComplete(): Promise<boolean> {
  // No-op on web
  return Promise.resolve(false);
}
