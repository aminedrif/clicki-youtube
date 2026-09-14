import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface QualityOption {
  id: string;
  label: string;
  format: 'mp4' | 'mp3';
  quality: string;
  badge?: string;
  isAudio?: boolean;
}

interface QualitySelectorProps {
  selectedId: string;
  onSelect: (option: QualityOption) => void;
  audioOnlyAvailable?: boolean;
}

export const DEFAULT_QUALITY_OPTIONS: QualityOption[] = [
  { id: '1080', label: '1080p Full HD', format: 'mp4', quality: '1080', badge: 'High Res' },
  { id: '720', label: '720p HD', format: 'mp4', quality: '720', badge: 'Recommended' },
  { id: '480', label: '480p SD', format: 'mp4', quality: '480' },
  { id: 'audio', label: 'Audio Only (MP3)', format: 'mp3', quality: 'best', isAudio: true },
];

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  selectedId,
  onSelect,
  audioOnlyAvailable = true,
}) => {
  const options = audioOnlyAvailable
    ? DEFAULT_QUALITY_OPTIONS
    : DEFAULT_QUALITY_OPTIONS.filter((opt) => !opt.isAudio);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SELECT QUALITY / FORMAT</Text>
      <View style={styles.optionsList}>
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.7}
              onPress={() => onSelect(option)}
              style={[
                styles.optionPill,
                isSelected ? styles.optionPillSelected : styles.optionPillUnselected,
              ]}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name={option.isAudio ? 'musical-notes' : 'videocam'}
                  size={18}
                  color={isSelected ? colors.glowViolet : colors.textMuted}
                  style={styles.optionIcon}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected ? styles.optionLabelSelected : styles.optionLabelUnselected,
                  ]}
                >
                  {option.label}
                </Text>
              </View>

              <View style={styles.optionRight}>
                {option.badge && (
                  <View
                    style={[
                      styles.badge,
                      isSelected ? styles.badgeSelected : styles.badgeUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected,
                      ]}
                    >
                      {option.badge}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.radio,
                    isSelected ? styles.radioSelected : styles.radioUnselected,
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  optionsList: {
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  optionPillUnselected: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderSubtle,
  },
  optionPillSelected: {
    backgroundColor: '#1E1430',
    borderColor: colors.accent,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionLabelUnselected: {
    color: colors.textSecondary,
  },
  optionLabelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeUnselected: {
    backgroundColor: '#20232B',
  },
  badgeSelected: {
    backgroundColor: `${colors.accent}30`,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextUnselected: {
    color: colors.textMuted,
  },
  badgeTextSelected: {
    color: colors.accent,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnselected: {
    borderColor: colors.textMuted,
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
