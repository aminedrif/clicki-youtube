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

  for (const [key, regex] of Object.entries(PLATFORM_PATTERNS) as [
    Exclude<SupportedPlatform, 'unknown'>,
    RegExp
  ][]) {
    if (regex.test(cleanUrl)) {
      return {
        platform: key,
        displayName: getPlatformDisplayName(key),
        color: getPlatformColor(key),
        iconName: getPlatformIcon(key),
        isValid: true,
      };
    }
  }

  return {
    platform: 'unknown',
    displayName: 'Social Link',
    color: '#6B7280',
    iconName: 'link-outline',
    isValid: false,
  };
}

export function getPlatformDisplayName(platform: SupportedPlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    case 'twitter':
      return 'X / Twitter';
    case 'facebook':
      return 'Facebook';
    case 'pinterest':
      return 'Pinterest';
    case 'reddit':
      return 'Reddit';
    case 'snapchat':
      return 'Snapchat';
    default:
      return 'Unknown';
  }
}

export function getPlatformColor(platform: SupportedPlatform): string {
  switch (platform) {
    case 'tiktok':
      return '#FE2C55';
    case 'instagram':
      return '#E1306C';
    case 'youtube':
      return '#FF0000';
    case 'twitter':
      return '#1DA1F2';
    case 'facebook':
      return '#1877F2';
    case 'pinterest':
      return '#E60023';
    case 'reddit':
      return '#FF4500';
    case 'snapchat':
      return '#FFFC00';
    default:
      return '#6B7280';
  }
}

export function getPlatformIcon(platform: SupportedPlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'logo-tiktok';
    case 'instagram':
      return 'logo-instagram';
    case 'youtube':
      return 'logo-youtube';
    case 'twitter':
      return 'logo-twitter';
    case 'facebook':
      return 'logo-facebook';
    case 'pinterest':
      return 'logo-pinterest';
    case 'reddit':
      return 'logo-reddit';
    case 'snapchat':
      return 'logo-snapchat';
    default:
      return 'globe-outline';
  }
}
