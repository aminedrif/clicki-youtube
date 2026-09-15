import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  ScrollView,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = Math.min(width * 0.76, 320);

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const SLEEP_OPTIONS = [
  { label: 'Turn off timer', value: null },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: 'End of current track', value: -1 },
];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const FullAudioPlayerModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    playbackTime,
    duration,
    playbackSpeed,
    repeatMode,
    isShuffle,
    sleepTimerMinutes,
    sleepTimerRemaining,
    isFullPlayerVisible,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    seekBy,
    setPlaybackSpeed,
    toggleRepeatMode,
    toggleShuffle,
    setSleepTimer,
    closeFullPlayer,
  } = useAudioPlayer();

  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const scrubberWidthRef = useRef(width - 56);
  const progressBarRef = useRef<View>(null);

  // Animated pulse for equalizer bars
  const eqAnim1 = useRef(new Animated.Value(0.4)).current;
  const eqAnim2 = useRef(new Animated.Value(0.8)).current;
  const eqAnim3 = useRef(new Animated.Value(0.3)).current;
  const eqAnim4 = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isPlaying) {
      const createLoop = (anim: Animated.Value, toVal: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: toVal,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.25,
              duration,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const l1 = createLoop(eqAnim1, 1.0, 420);
      const l2 = createLoop(eqAnim2, 0.9, 580);
      const l3 = createLoop(eqAnim3, 1.0, 360);
      const l4 = createLoop(eqAnim4, 0.85, 490);

      l1.start();
      l2.start();
      l3.start();
      l4.start();

      return () => {
        l1.stop();
        l2.stop();
        l3.stop();
        l4.stop();
      };
    } else {
      eqAnim1.setValue(0.25);
      eqAnim2.setValue(0.25);
      eqAnim3.setValue(0.25);
      eqAnim4.setValue(0.25);
    }
  }, [isPlaying]);

  if (!currentTrack) return null;

  const currentDisplayTime = isScrubbing ? scrubValue : playbackTime;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentDisplayTime / duration)) : 0;
  const remainingTime = duration > 0 ? Math.max(0, duration - currentDisplayTime) : 0;

  const handleShare = async () => {
    if (!currentTrack.file_path) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(currentTrack.file_path);
    } catch (e: any) {
      console.warn('Share error:', e);
    }
  };

  const handleScrubberPress = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    const barWidth = scrubberWidthRef.current;
    if (barWidth <= 0 || duration <= 0) return;
    const targetRatio = Math.min(1, Math.max(0, touchX / barWidth));
    const targetSeconds = targetRatio * duration;
    seekTo(targetSeconds);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      const touchX = evt.nativeEvent.locationX;
      const barWidth = scrubberWidthRef.current;
      if (barWidth > 0 && duration > 0) {
        setScrubValue(Math.min(1, Math.max(0, touchX / barWidth)) * duration);
      }
    },
    onPanResponderMove: (evt) => {
      const touchX = evt.nativeEvent.locationX;
      const barWidth = scrubberWidthRef.current;
      if (barWidth > 0 && duration > 0) {
        setScrubValue(Math.min(1, Math.max(0, touchX / barWidth)) * duration);
      }
    },
    onPanResponderRelease: () => {
      setIsScrubbing(false);
      seekTo(scrubValue);
    },
    onPanResponderTerminate: () => {
      setIsScrubbing(false);
    },
  });

  return (
    <Modal
      visible={isFullPlayerVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeFullPlayer}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={closeFullPlayer}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSubtitle}>PLAYING FROM LIBRARY</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              CLICKI AUDIO
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.headerIconBtn,
              sleepTimerMinutes !== null && styles.sleepActiveBtn,
            ]}
            onPress={() => setIsSleepModalOpen(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="moon"
              size={20}
              color={sleepTimerMinutes !== null ? colors.accent : '#9CA3AF'}
            />
            {sleepTimerRemaining !== null && (
              <View style={styles.sleepBadge}>
                <Text style={styles.sleepBadgeText}>
                  {Math.ceil(sleepTimerRemaining / 60)}m
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Album Artwork with Glow */}
          <View style={styles.artWrapper}>
            <View style={styles.artGlowEffect} />
            <View style={styles.artContainer}>
              {currentTrack.thumbnail_local_path ? (
                <Image
                  source={{ uri: currentTrack.thumbnail_local_path }}
                  style={styles.artImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.artFallback}>
                  <Ionicons name="musical-notes" size={72} color={colors.accent} />
                </View>
              )}

              {/* Animated Equalizer Overlay */}
              <View style={styles.eqContainer}>
                <Animated.View
                  style={[styles.eqBar, { transform: [{ scaleY: eqAnim1 }] }]}
                />
                <Animated.View
                  style={[styles.eqBar, { transform: [{ scaleY: eqAnim2 }] }]}
                />
                <Animated.View
                  style={[styles.eqBar, { transform: [{ scaleY: eqAnim3 }] }]}
                />
                <Animated.View
                  style={[styles.eqBar, { transform: [{ scaleY: eqAnim4 }] }]}
                />
              </View>
            </View>
          </View>

          {/* Title & Metadata Row */}
          <View style={styles.infoSection}>
            <View style={styles.titleColumn}>
              <Text style={styles.songTitle} numberOfLines={2}>
                {currentTrack.title}
              </Text>
              <View style={styles.metaBadgeRow}>
                <View style={styles.qualityPill}>
                  <Text style={styles.qualityText}>
                    {currentTrack.quality || '320kbps'} MP3
                  </Text>
                </View>
                <Text style={styles.channelText}>Offline Audio</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-social-outline" size={22} color="#D1D5DB" />
            </TouchableOpacity>
          </View>

          {/* Scrubber / Progress Bar */}
          <View style={styles.scrubberSection}>
            <View
              ref={progressBarRef}
              style={styles.scrubberTrackTouchArea}
              onLayout={(e) => {
                scrubberWidthRef.current = e.nativeEvent.layout.width;
              }}
              {...panResponder.panHandlers}
            >
              <View style={styles.scrubberBackground}>
                <View
                  style={[
                    styles.scrubberFill,
                    { width: `${progressRatio * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.scrubberThumb,
                    { left: `${progressRatio * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {formatTime(currentDisplayTime)}
              </Text>
              <Text style={styles.timeText}>
                -{formatTime(remainingTime)}
              </Text>
            </View>
          </View>

          {/* Speed & Jump 10s Row */}
          <View style={styles.secondaryControlsRow}>
            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={() => seekBy(-10)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#D1D5DB" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.jumpBtnText}>-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.speedSelectorPill}
              onPress={() => setIsSpeedModalOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="speedometer-outline" size={15} color={colors.accent} />
              <Text style={styles.speedSelectorText}>{playbackSpeed}x SPEED</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={() => seekBy(10)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#D1D5DB" />
              <Text style={styles.jumpBtnText}>+10s</Text>
            </TouchableOpacity>
          </View>

          {/* Primary Controls (Shuffle, Prev, Play, Next, Repeat) */}
          <View style={styles.mainControlsRow}>
            {/* Shuffle */}
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={toggleShuffle}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="shuffle"
                size={22}
                color={isShuffle ? colors.accent : '#6B7280'}
              />
              {isShuffle && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Prev Track */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={prevTrack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-skip-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Play / Pause Giant Red Circle */}
            <TouchableOpacity
              style={styles.giantPlayBtn}
              onPress={togglePlayPause}
              activeOpacity={0.88}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={34}
                color="#FFFFFF"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </TouchableOpacity>

            {/* Next Track */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={nextTrack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-skip-forward" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Repeat Mode */}
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={toggleRepeatMode}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="repeat"
                size={22}
                color={repeatMode !== 'off' ? colors.accent : '#6B7280'}
              />
              {repeatMode === 'one' && (
                <View style={styles.repeatOneBadge}>
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              )}
              {repeatMode === 'all' && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Speed Selector Modal */}
        <Modal
          visible={isSpeedModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsSpeedModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsSpeedModalOpen(false)}
          >
            <View style={styles.speedModalBox}>
              <Text style={styles.modalBoxTitle}>PLAYBACK SPEED</Text>
              <View style={styles.speedGrid}>
                {SPEED_OPTIONS.map((spd) => {
                  const isSelected = playbackSpeed === spd;
                  return (
                    <TouchableOpacity
                      key={spd}
                      style={[
                        styles.speedOptionBtn,
                        isSelected && styles.speedOptionSelected,
                      ]}
                      onPress={() => {
                        setPlaybackSpeed(spd);
                        setIsSpeedModalOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.speedOptionText,
                          isSelected && styles.speedOptionTextSelected,
                        ]}
                      >
                        {spd}x
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.accent}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsSpeedModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Sleep Timer Modal */}
        <Modal
          visible={isSleepModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsSleepModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsSleepModalOpen(false)}
          >
            <View style={styles.speedModalBox}>
              <View style={styles.sleepModalHeader}>
                <Ionicons name="moon" size={20} color={colors.accent} />
                <Text style={styles.modalBoxTitle}>SLEEP TIMER</Text>
              </View>
              <Text style={styles.sleepModalSubtitle}>
                Stop audio playback automatically after:
              </Text>

              <View style={styles.sleepOptionsList}>
                {SLEEP_OPTIONS.map((opt, idx) => {
                  const isSelected = sleepTimerMinutes === opt.value;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.sleepOptionItem,
                        isSelected && styles.sleepOptionItemSelected,
                      ]}
                      onPress={() => {
                        setSleepTimer(opt.value);
                        setIsSleepModalOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.sleepOptionText,
                          isSelected && styles.sleepOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.accent}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsSleepModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>DISMISS</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sleepActiveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  sleepBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sleepBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  artWrapper: {
    marginTop: 20,
    marginBottom: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artGlowEffect: {
    position: 'absolute',
    width: ARTWORK_SIZE + 24,
    height: ARTWORK_SIZE + 24,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 12,
  },
  artContainer: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#16161E',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  eqContainer: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  eqBar: {
    width: 3.5,
    height: 18,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  infoSection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  titleColumn: {
    flex: 1,
    marginRight: 16,
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
    lineHeight: 24,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qualityText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  channelText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrubberSection: {
    width: '100%',
    marginBottom: 16,
  },
  scrubberTrackTouchArea: {
    height: 30,
    justifyContent: 'center',
  },
  scrubberBackground: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  scrubberFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 14,
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  jumpBtnText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  speedSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  speedSelectorText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    paddingHorizontal: 6,
  },
  controlIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  skipBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giantPlayBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  speedModalBox: {
    width: '100%',
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalBoxTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  speedOptionBtn: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  speedOptionSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: colors.accent,
  },
  speedOptionText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
  },
  speedOptionTextSelected: {
    color: colors.accent,
    fontWeight: '800',
  },
  sleepModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sleepModalSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  sleepOptionsList: {
    gap: 8,
    marginBottom: 18,
  },
  sleepOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sleepOptionItemSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.accent,
  },
  sleepOptionText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  sleepOptionTextSelected: {
    color: colors.accent,
    fontWeight: '800',
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
