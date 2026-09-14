export const colors = {
  // Pure OLED blacks & deep space tones
  background: '#000000',
  surface: '#05070A',
  surfaceCard: '#0B0F17',
  surfaceElevated: '#111827',
  border: '#1E293B',
  borderSubtle: '#0F172A',

  // Singularity / Event horizon accents (Sky Blue / Bleu Ciel)
  singularityCore: '#000000',
  accretionInner: '#032840',
  accretionMid: '#0284C7',
  accretionOuter: '#38BDF8',
  glowPurple: '#0284C7',
  glowCyan: '#38BDF8',
  glowSkyBlue: '#00D2FF',
  glowViolet: '#38BDF8',
  glowWhite: '#FFFFFF',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDisabled: '#475569',

  // Actions & States
  primary: '#FFFFFF',
  primaryText: '#000000',
  accent: '#38BDF8', // Radiant Bleu Ciel
  accentGlow: 'rgba(56, 189, 248, 0.35)',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',

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
