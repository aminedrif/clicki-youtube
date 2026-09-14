import { SupportedPlatform } from '../database/types';

export interface PlatformInfo {
  platform: SupportedPlatform;
  displayName: string;
  color: string;
  iconName: string;
  isValid: boolean;
}

const PLATFORM_PATTERNS: { [key in Exclude<SupportedPlatform, 'unknown'>]: RegExp } = {
  tiktok: /(?:https?:\/\/)?(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[@A-Za-z0-9_.\/]+/i,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[A-Za-z0-9_-]+/i,
  youtube: /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|v\/)|youtu\.be\/)[A-Za-z0-9_-]+/i,
  twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status\/[0-9]+/i,
  facebook: /(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.gg)/i,
  pinterest: /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:pinterest\.[a-z.]+|pin\.it)\/[A-Za-z0-9_.\/-]+/i,
  reddit: /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:reddit\.com|redd\.it)\/[A-Za-z0-9_.\/-]+/i,
  snapchat: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/(?:spotlight|add|t)\/[A-Za-z0-9_-]+/i,
};

const URL_EXTRACT_REGEX = /(https?:\/\/[^\s]+)/gi;

export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_EXTRACT_REGEX);
  if (matches && matches.length > 0) {
    return matches[0].trim();
  }
  return null;
}

export function detectPlatform(url: string): PlatformInfo {
  const cleanUrl = url.trim();

  // Explicitly reject YouTube per policy
  if (PLATFORM_PATTERNS.youtube.test(cleanUrl)) {
    return {
      platform: 'youtube',
      displayName: 'Media',
      color: '#EF4444',
      iconName: 'alert-circle-outline',
      isValid: false,
    };
  }

  for (const [key, regex] of Object.entries(PLATFORM_PATTERNS) as [
    Exclude<SupportedPlatform, 'unknown'>,
    RegExp
  ][]) {
    if (key !== 'youtube' && regex.test(cleanUrl)) {
      return {
        platform: key,
        displayName: 'Media',
        color: getPlatformColor(key),
        iconName: getPlatformIcon(key),
        isValid: true,
      };
    }
  }

  return {
    platform: 'unknown',
    displayName: 'Link',
    color: '#6B7280',
    iconName: 'link-outline',
    isValid: false,
  };
}

export function getPlatformDisplayName(platform: SupportedPlatform): string {
  if (platform === 'youtube') return 'YouTube (Unsupported)';
  return 'Media';
}

export function getPlatformColor(platform: SupportedPlatform): string {
  if (platform === 'youtube') return '#EF4444';
  return '#A855F7';
}

export function getPlatformIcon(platform: SupportedPlatform): string {
  return 'videocam-outline';
}
