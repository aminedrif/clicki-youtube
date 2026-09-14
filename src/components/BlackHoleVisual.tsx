import React, { useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const HOLE_SIZE = Math.min(width * 0.72, 290);

export type BlackHoleStatus = 'idle' | 'resolving' | 'downloading' | 'success' | 'error';

interface BlackHoleVisualProps {
  onPress: () => void;
  isSucking?: boolean;
  disabled?: boolean;
  status?: BlackHoleStatus;
  label?: string;
}

export const BlackHoleVisual: React.FC<BlackHoleVisualProps> = ({
  onPress,
  isSucking = false,
  disabled = false,
  status = 'idle',
  label,
}) => {
  // Idle breathing pulse animation
  const pulseAnim = useSharedValue(0);
  // Continuous rotation for accretion disk
  const rotationAnim = useSharedValue(0);
  // Sucking in / ingestion transition animation
  const suckAnim = useSharedValue(0);
  // Touch press feedback
  const pressAnim = useSharedValue(1);

  // Animated moving dots during resolving and downloading
  const [dots, setDots] = React.useState('.');
  React.useEffect(() => {
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
    // Ambient breathing pulse
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Continuous celestial rotation (spins faster when downloading)
    const duration = status === 'downloading' ? 6000 : 24000;
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
        withTiming(0, { duration: 300 })
      );
    }
  }, [isSucking]);

  const handlePressIn = () => {
    pressAnim.value = withSpring(0.94, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    pressAnim.value = withSpring(1, { damping: 12, stiffness: 180 });
  };

  const animatedHoleStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(pulseAnim.value, [0, 1], [0.97, 1.03]);
    const suckScale = interpolate(suckAnim.value, [0, 0.7, 1], [1, 0.82, 1]);

    return {
      transform: [
        { scale: pressAnim.value * pulseScale * suckScale },
      ],
    };
  });

  const animatedAccretionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pulseAnim.value, [0, 1], [0.75, 1]);
    const suckRotate = interpolate(suckAnim.value, [0, 1], [0, 720]);

    return {
      opacity,
      transform: [
        { rotate: `${rotationAnim.value + suckRotate}deg` },
      ],
    };
  });

  const animatedInwardRingStyle = useAnimatedStyle(() => {
    const ringScale = interpolate(suckAnim.value, [0, 1], [1.4, 0.1]);
    const ringOpacity = interpolate(suckAnim.value, [0, 0.2, 0.8, 1], [0, 0.9, 0.8, 0]);

    return {
      opacity: ringOpacity,
      transform: [{ scale: ringScale }],
    };
  });

  // Determine center text and colors
  let displayText = label;
  if (!displayText) {
    if (status === 'resolving') displayText = `INGESTING${dots}`;
    else if (status === 'downloading') displayText = `DOWNLOADING${dots}`;
    else if (status === 'success') displayText = 'SAVED TO PHOTOS';
    else if (status === 'error') displayText = 'TRY AGAIN';
    else displayText = 'INGEST';
  }

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isWorking = status === 'resolving' || status === 'downloading';

  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isWorking}
        style={styles.touchTarget}
      >
        <Animated.View style={[styles.holeContainer, animatedHoleStyle]}>
          {/* Outermost ambient gravitational glow */}
          <LinearGradient
            colors={
              isSuccess
                ? ['rgba(16, 185, 129, 0.25)', 'rgba(5, 150, 105, 0.1)', 'transparent']
                : isError
                ? ['rgba(239, 68, 68, 0.25)', 'rgba(185, 28, 28, 0.1)', 'transparent']
                : ['rgba(121, 40, 202, 0.18)', 'rgba(61, 28, 104, 0.08)', 'transparent']
            }
            style={styles.outerAmbientGlow}
          />

          {/* Rotating accretion disk */}
          <Animated.View style={[styles.accretionDisk, animatedAccretionStyle]}>
            <LinearGradient
              colors={
                isSuccess
                  ? [
                      'rgba(16, 185, 129, 0.45)',
                      'rgba(6, 182, 212, 0.3)',
                      'rgba(16, 185, 129, 0.15)',
                      'transparent',
                    ]
                  : [
                      'rgba(147, 51, 234, 0.35)',
                      'rgba(6, 182, 212, 0.25)',
                      'rgba(121, 40, 202, 0.15)',
                      'rgba(30, 16, 53, 0.05)',
                      'transparent',
                    ]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.accretionGradient}
            />
          </Animated.View>

          {/* Inward sucking event horizon ring */}
          <Animated.View style={[styles.inwardRing, animatedInwardRingStyle]} />

          {/* Event Horizon boundary ring */}
          <View
            style={[
              styles.eventHorizonRing,
              isSuccess && { borderColor: 'rgba(16, 185, 129, 0.7)' },
              isError && { borderColor: 'rgba(239, 68, 68, 0.7)' },
            ]}
          >
            <LinearGradient
              colors={
                isSuccess
                  ? ['rgba(16, 185, 129, 0.4)', 'rgba(6, 182, 212, 0.2)', 'rgba(0, 0, 0, 0.9)']
                  : isError
                  ? ['rgba(239, 68, 68, 0.4)', 'rgba(121, 40, 202, 0.2)', 'rgba(0, 0, 0, 0.9)']
                  : ['rgba(168, 85, 247, 0.4)', 'rgba(6, 182, 212, 0.2)', 'rgba(0, 0, 0, 0.9)']
              }
              style={styles.horizonGradient}
            />
          </View>

          {/* The Singularity (Pure OLED Black Center) */}
          <View
            style={[
              styles.singularity,
              isSuccess && { borderColor: 'rgba(16, 185, 129, 0.5)' },
              isError && { borderColor: 'rgba(239, 68, 68, 0.5)' },
            ]}
          >
            <View
              style={[
                styles.singularityInnerGlow,
                isSuccess && { backgroundColor: '#021810' },
                isError && { backgroundColor: '#180303' },
              ]}
            />
            {isSuccess && (
              <Ionicons
                name="checkmark-circle"
                size={26}
                color={colors.success}
                style={{ marginBottom: 4 }}
              />
            )}
            <Text
              style={[
                styles.singularityLabel,
                isSuccess && styles.labelSuccess,
                isError && styles.labelError,
                isWorking && styles.labelWorking,
              ]}
              numberOfLines={2}
            >
              {displayText}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchTarget: {
    width: HOLE_SIZE + 60,
    height: HOLE_SIZE + 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeContainer: {
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerAmbientGlow: {
    position: 'absolute',
    width: HOLE_SIZE + 50,
    height: HOLE_SIZE + 50,
    borderRadius: (HOLE_SIZE + 50) / 2,
  },
  accretionDisk: {
    position: 'absolute',
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    borderRadius: HOLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accretionGradient: {
    width: '100%',
    height: '100%',
    borderRadius: HOLE_SIZE / 2,
  },
  inwardRing: {
    position: 'absolute',
    width: HOLE_SIZE * 0.9,
    height: HOLE_SIZE * 0.9,
    borderRadius: (HOLE_SIZE * 0.9) / 2,
    borderWidth: 2,
    borderColor: colors.glowCyan,
    shadowColor: colors.glowViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  eventHorizonRing: {
    position: 'absolute',
    width: HOLE_SIZE * 0.76,
    height: HOLE_SIZE * 0.76,
    borderRadius: (HOLE_SIZE * 0.76) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.6)',
    overflow: 'hidden',
  },
  horizonGradient: {
    width: '100%',
    height: '100%',
  },
  singularity: {
    width: HOLE_SIZE * 0.62,
    height: HOLE_SIZE * 0.62,
    borderRadius: (HOLE_SIZE * 0.62) / 2,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#181A22',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  singularityInnerGlow: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: (HOLE_SIZE * 0.62 * 0.9) / 2,
    backgroundColor: '#050308',
  },
  singularityLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  labelSuccess: {
    color: '#10B981',
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  labelWorking: {
    color: '#06B6D4',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 11,
  },
  labelError: {
    color: '#EF4444',
    fontWeight: '700',
    letterSpacing: 1.5,
    fontSize: 11,
  },
});
