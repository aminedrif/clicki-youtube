import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface GlobalMiniPlayerProps {
  onPress?: () => void;
  bottomOffset?: number;
}

export const GlobalMiniPlayer: React.FC<GlobalMiniPlayerProps> = ({
  onPress,
  bottomOffset = 90,
}) => {
  const {
    currentTrack,
    isPlaying,
    playbackTime,
    duration,
    togglePlayPause,
    nextTrack,
    prevTrack,
    dismissPlayer,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, playbackTime / duration)) : 0;

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {/* Progress line */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>

      <TouchableOpacity
        style={styles.innerContent}
        activeOpacity={0.88}
        onPress={onPress}
      >
        {/* Album Art */}
        <View style={styles.artContainer}>
          {currentTrack.thumbnail_local_path ? (
            <Image
              source={{ uri: currentTrack.thumbnail_local_path }}
              style={styles.artImage}
            />
          ) : (
            <View style={styles.artFallback}>
              <Ionicons name="musical-notes" size={18} color={colors.accent} />
            </View>
          )}
        </View>

        {/* Track Title & Artist */}
        <View style={styles.infoContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            CLICKI Audio • {currentTrack.quality || '320kbps'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={prevTrack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="play-skip-back" size={18} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={nextTrack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="play-skip-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={dismissPlayer}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: 'rgba(18, 18, 22, 0.96)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  progressBarBackground: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  artContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  artImage: {
    width: 44,
    height: 44,
  },
  artFallback: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  subText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 2,
  },
});
