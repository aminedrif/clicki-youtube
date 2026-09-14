export const colors = {
  // Pure OLED blacks & deep space tones
  background: '#000000',
  surface: '#0A0B0E',
  surfaceCard: '#12141A',
  surfaceElevated: '#1A1D24',
  border: '#232733',
  borderSubtle: '#181A20',

  // Singularity / Event horizon accents
  singularityCore: '#000000',
  accretionInner: '#1E1035',
  accretionMid: '#3D1C68',
  accretionOuter: '#7928CA',
  glowPurple: '#9333EA',
  glowCyan: '#06B6D4',
  glowViolet: '#A855F7',
  glowWhite: '#FFFFFF',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDisabled: '#4B5563',

  // Actions & States
  primary: '#FFFFFF',
  primaryText: '#000000',
  accent: '#A855F7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Social platforms
  platforms: {
    tiktok: '#FE2C55',
    instagram: '#E1306C',
    youtube: '#FF0000',
    twitter: '#1DA1F2',
    facebook: '#1877F2',
    pinterest: '#E60023',
    reddit: '#FF4500',
    snapchat: '#FFFC00',
    unknown: '#6B7280',
  },
} as const;

export type ColorKeys = keyof typeof colors;
