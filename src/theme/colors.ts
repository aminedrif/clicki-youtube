export const colors = {
  // Pure OLED blacks & deep space tones
  background: '#000000',
  surface: '#05070A',
  surfaceCard: '#0B0F17',
  surfaceElevated: '#111827',
  border: '#1E293B',
  borderSubtle: '#0F172A',

  // Singularity / Event horizon accents (Crimson & YouTube Red)
  singularityCore: '#000000',
  accretionInner: '#3B0707',
  accretionMid: '#B91C1C',
  accretionOuter: '#EF4444',
  glowPurple: '#DC2626',
  glowCyan: '#F87171',
  glowSkyBlue: '#EF4444',
  glowViolet: '#DC2626',
  glowWhite: '#FFFFFF',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDisabled: '#475569',

  // Actions & States
  primary: '#FFFFFF',
  primaryText: '#000000',
  accent: '#EF4444', // Radiant YouTube Red
  accentGlow: 'rgba(239, 68, 68, 0.4)',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#EF4444',

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
    unknown: '#64748B',
  },
} as const;

export type ColorKeys = keyof typeof colors;
