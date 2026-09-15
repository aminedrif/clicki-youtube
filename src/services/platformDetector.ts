import { SupportedPlatform } from '../database/types';

export interface PlatformInfo {
  platform: SupportedPlatform;
  displayName: string;
  color: string;
  iconName: string;
  isValid: boolean;
}

// Strictly YouTube regex covering standard watch URLs, youtu.be shortlinks, shorts, embeds, mobile, and music
export const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

const URL_EXTRACT_REGEX = /(https?:\/\/[^\s]+)/gi;

export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_EXTRACT_REGEX);
  if (matches && matches.length > 0) {
    return matches[0].trim();
  }
  return null;
}

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match && match[1] ? match[1] : null;
}

export function detectPlatform(url: string): PlatformInfo {
  const cleanUrl = url.trim();

  // ONLY YouTube is supported in CLICKI Youtube
  if (YOUTUBE_REGEX.test(cleanUrl)) {
    return {
      platform: 'youtube',
      displayName: 'YouTube',
      color: '#FF0000',
      iconName: 'logo-youtube',
      isValid: true,
    };
  }

  // All other platforms are explicitly rejected
  return {
    platform: 'unknown',
    displayName: 'Unsupported Link',
    color: '#6B7280',
    iconName: 'alert-circle-outline',
    isValid: false,
  };
}

export function getPlatformDisplayName(platform: SupportedPlatform): string {
  if (platform === 'youtube') return 'YouTube';
  return 'Unsupported';
}

export function getPlatformColor(platform: SupportedPlatform): string {
  if (platform === 'youtube') return '#FF0000';
  return '#64748B';
}

export function getPlatformIcon(platform: SupportedPlatform): string {
  if (platform === 'youtube') return 'logo-youtube';
  return 'help-circle-outline';
}
