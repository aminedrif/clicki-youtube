import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

// Exact same black hole logo image used throughout the application and icon
const LOGO_SOURCE = require('../../assets/icon.png');

const { width } = Dimensions.get('window');
const DEFAULT_HOLE_SIZE = Math.min(width * 0.72, 290);

export type BlackHoleStatus = 'idle' | 'resolving' | 'downloading' | 'success' | 'error';

export interface BlackHoleVisualProps {
  onPress?: () => void;
  isSucking?: boolean;
  disabled?: boolean;
  status?: BlackHoleStatus;
  label?: string;
  size?: number;
  showLabel?: boolean;
  showAmbientGlow?: boolean;
}

export const BlackHoleVisual: React.FC<BlackHoleVisualProps> = ({
  onPress,
  isSucking = false,
  disabled = false,
  status = 'idle',
  label,
  size,
  showLabel,
  showAmbientGlow,
}) => {
  const holeSize = size || DEFAULT_HOLE_SIZE;
  const isCompact = holeSize < 80;
  const shouldShowGlow = showAmbientGlow !== undefined ? showAmbientGlow : !isCompact;
  const shouldShowLabel = showLabel !== undefined ? showLabel : !isCompact;

  // Breathing pulse: expands larger and then returns back to size
  const pulseAnim = useSharedValue(0);
  // Continuous rotation: the blue shadow swirling around the hole
  const rotationAnim = useSharedValue(0);
  // Ingestion vortex transition on link detection / ingest
  const suckAnim = useSharedValue(0);
  // Touch press spring feedback
  const pressAnim = useSharedValue(1);

  // Animated moving dots during resolving and downloading
  const [dots, setDots] = useState('.');
  useEffect(() => {
    if (status === 'resolving' || status === 'downloading') {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
      }, 450);
      return () => clearInterval(interval);
    } else {
      setDots('.');
    }
  }, [status]);

  useEffect(() => {
    // Ambient breathing pulse: smooth expansion and contraction (getting bigger, then returning to size)
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Continuous celestial rotation of the blue shadow around the hole
    const duration = status === 'downloading' ? 5000 : 20000;
    rotationAnim.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, [status]);

  useEffect(() => {
    if (isSucking) {
      suckAnim.value = withSequence(
        withTiming(1, { duration: 550, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
        withTiming(0, { duration: 350 })
      );
    }
  }, [isSucking]);

  const handlePressIn = () => {
    if (onPress && !disabled) {
      pressAnim.value = withSpring(0.93, { damping: 15, stiffness: 220 });
    }
  };

  const handlePressOut = () => {
    if (onPress && !disabled) {
      pressAnim.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  };

  // Rotating and breathing animation for the exact logo image
  const animatedLogoStyle = useAnimatedStyle(() => {
    // Scale breathes from 0.93 to 1.15: visibly getting bigger and returning to size
    const pulseScale = interpolate(pulseAnim.value, [0, 1], [0.93, 1.15]);
    const suckScale = interpolate(suckAnim.value, [0, 0.65, 1], [1, 0.8, 1]);
    const suckRotate = interpolate(suckAnim.value, [0, 1], [0, 720]);

    return {
      transform: [
        { scale: pressAnim.value * pulseScale * suckScale },
        { rotate: `${rotationAnim.value + suckRotate}deg` },
      ],
    };
  });

  // Inward ingestion ring during suction
  const animatedInwardRingStyle = useAnimatedStyle(() => {
    const ringScale = interpolate(suckAnim.value, [0, 1], [1.35, 0.1]);
    const ringOpacity = interpolate(suckAnim.value, [0, 0.2, 0.8, 1], [0, 0.95, 0.8, 0]);

    return {
      opacity: ringOpacity,
      transform: [{ scale: ringScale }],
    };
  });

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isWorking = status === 'resolving' || status === 'downloading';

  let displayText = label;
  if (!displayText) {
    if (status === 'resolving') displayText = `INGESTING${dots}`;
    else if (status === 'downloading') displayText = `DOWNLOADING${dots}`;
    else if (status === 'success') displayText = 'SAVED TO PHOTOS';
    else if (status === 'error') displayText = 'TRY AGAIN';
    else displayText = 'INGEST';
  }

  const visualContent = (
    <View style={[styles.visualContainer, { width: holeSize, height: holeSize }]}>
      {/* The EXACT SAME Black Hole Logo Image with Continuous Rotation & Breathing Scale */}
      <Animated.Image
        source={LOGO_SOURCE}
        style={[
          {
            width: holeSize,
            height: holeSize,
            borderRadius: holeSize / 2,
          },
          animatedLogoStyle,
        ]}
        resizeMode="contain"
      />

      {/* Inward Ingestion Vortex Ring */}
      {isSucking && (
        <Animated.View
          style={[
            styles.inwardRing,
            {
              width: holeSize * 0.85,
              height: holeSize * 0.85,
              borderRadius: (holeSize * 0.85) / 2,
            },
            animatedInwardRingStyle,
          ]}
          pointerEvents="none"
        />
      )}

      {/* Singularity Center Label Overlay */}
      {shouldShowLabel && (
        <View
          style={[
            styles.centerOverlay,
            {
              width: holeSize * 0.42,
              height: holeSize * 0.42,
              borderRadius: (holeSize * 0.42) / 2,
            },
            isSuccess && { borderColor: 'rgba(16, 185, 129, 0.6)' },
            isError && { borderColor: 'rgba(239, 68, 68, 0.6)' },
          ]}
          pointerEvents="none"
        >
          {isSuccess && (
            <Ionicons
              name="checkmark-circle"
              size={Math.max(16, Math.round(holeSize * 0.09))}
              color={colors.success}
              style={{ marginBottom: 2 }}
            />
          )}
          {isError && (
            <Ionicons
              name="alert-circle"
              size={Math.max(16, Math.round(holeSize * 0.09))}
              color={colors.danger}
              style={{ marginBottom: 2 }}
            />
          )}
          <Text
            style={[
              styles.singularityLabel,
              { fontSize: Math.max(9, Math.round(holeSize * 0.038)) },
              isSuccess && styles.labelSuccess,
              isError && styles.labelError,
              isWorking && styles.labelWorking,
            ]}
            numberOfLines={2}
          >
            {displayText}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isWorking}
        style={[
          styles.touchTarget,
          { width: holeSize + (isCompact ? 8 : 40), height: holeSize + (isCompact ? 8 : 40) },
        ]}
      >
        {visualContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.staticWrapper, { width: holeSize, height: holeSize }]}>
      {visualContent}
    </View>
  );
};

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
  },
  inwardRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  singularityLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  labelSuccess: {
    color: '#10B981',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  labelWorking: {
    color: '#EF4444',
    fontWeight: '700',
    letterSpacing: 2,
  },
  labelError: {
    color: '#EF4444',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
