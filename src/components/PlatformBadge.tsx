import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupportedPlatform } from '../database/types';
import { getPlatformColor, getPlatformDisplayName, getPlatformIcon } from '../services/platformDetector';

interface PlatformBadgeProps {
  platform?: SupportedPlatform;
  format?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  format,
  size = 'medium',
  showLabel = true,
}) => {
  const color = '#38BDF8';
  const name = 'VIDEO';
  const iconName = 'videocam-outline';

  const iconSize = size === 'small' ? 12 : size === 'large' ? 18 : 14;
  const paddingH = size === 'small' ? 6 : size === 'large' ? 12 : 8;
  const paddingV = size === 'small' ? 3 : size === 'large' ? 6 : 4;
  const fontSize = size === 'small' ? 10 : size === 'large' ? 13 : 11;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${color}18`,
          borderColor: `${color}40`,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <Ionicons name={iconName} size={iconSize} color={color} style={styles.icon} />
      {showLabel && (
        <Text style={[styles.text, { color, fontSize }]}>
          {name}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
