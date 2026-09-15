import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../navigation/types';
import { BlackHoleVisual, BlackHoleStatus } from '../components/BlackHoleVisual';
import { GlobalMiniPlayer } from '../components/GlobalMiniPlayer';
import { AppInfoModal } from '../components/AppInfoModal';
import { useClipboardDetector } from '../hooks/useClipboardDetector';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { resolveCobaltMedia } from '../api/cobaltClient';
import { showInterstitialOnDownloadClick } from '../services/adMobService';
import { colors } from '../theme/colors';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { checkClipboard, feedbackMessage, clearFeedback } = useClipboardDetector();
  const { startDownload, cancelDownload, downloadState } = useDownloadManager();

  const [holeStatus, setHoleStatus] = useState<BlackHoleStatus>('idle');
  const [isSucking, setIsSucking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [downloadSuccessTitle, setDownloadSuccessTitle] = useState<string | null>(null);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  const handleHolePress = async () => {
    // Instantly show ad popup on button click (session-limited, works for both MP3 & MP4)
    showInterstitialOnDownloadClick().catch(() => {});

    if (holeStatus === 'resolving' || holeStatus === 'downloading') return;
    setErrorMessage(null);
    clearFeedback();

    const result = await checkClipboard();

    if (result.hasValidUrl && result.url) {
      processUrl(result.url);
    }
  };

  const processUrl = async (url: string) => {
    setHoleStatus('resolving');
    setErrorMessage(null);
    setDownloadSuccessTitle(null);
    setIsSucking(true);
    setTimeout(() => setIsSucking(false), 900);

    try {
      // 1. Resolve YouTube media stream as MP3 or MP4
      const isAudio = selectedFormat === 'mp3';
      const resolveData = await resolveCobaltMedia(url, {
        audioOnly: isAudio,
        audioFormat: 'mp3',
        videoQuality: '1080',
      });

      if (!resolveData || !resolveData.url) {
        throw new Error('Could not extract media stream for this YouTube video.');
      }

      // 2. Immediately start downloading
      setHoleStatus('downloading');

      // Trigger session-limited AdMob popup on download click
      showInterstitialOnDownloadClick().catch(() => {});

      let savedRecord: any = null;
      try {
        savedRecord = await startDownload(
          resolveData,
          isAudio ? '320kbps' : '1080p',
          selectedFormat,
          resolveData.url
        );
      } catch (dlErr: any) {
        throw new Error(dlErr.message || 'Download failed.');
      }

      if (savedRecord) {
        setHoleStatus('success');
        setDownloadSuccessTitle(savedRecord.title);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Reset back to idle after 4 seconds
        setTimeout(() => {
          setHoleStatus('idle');
          setDownloadSuccessTitle(null);
        }, 4000);
      } else {
        setHoleStatus('error');
        setErrorMessage(downloadState.error || 'Download failed or was interrupted.');
        setTimeout(() => setHoleStatus('idle'), 3500);
      }
    } catch (err: any) {
      setHoleStatus('error');
      setErrorMessage(err.message || 'Failed to download YouTube media.');
      setTimeout(() => setHoleStatus('idle'), 4000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Brand Header with App Info Button */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeftSpacer} />
        <View style={styles.topHeaderCenter}>
          <BlackHoleVisual size={22} showLabel={false} disabled />
          <Text style={styles.topHeaderTitle}>CLICKI YOUTUBE</Text>
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            setIsInfoModalVisible(true);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.infoButtonText}>!</Text>
        </TouchableOpacity>
      </View>

      {/* Format Selector Pill (MP3 Audio vs MP4 Video) */}
      <View style={styles.formatSelectorRow}>
        <TouchableOpacity
          style={[
            styles.formatPill,
            selectedFormat === 'mp3' && styles.formatPillActive,
          ]}
          onPress={() => {
            setSelectedFormat('mp3');
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="musical-notes-outline"
            size={14}
            color={selectedFormat === 'mp3' ? '#FFFFFF' : colors.textMuted}
          />
          <Text
            style={[
              styles.formatPillText,
              selectedFormat === 'mp3' && styles.formatPillTextActive,
            ]}
          >
            MP3 AUDIO
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatPill,
            selectedFormat === 'mp4' && styles.formatPillActive,
          ]}
          onPress={() => {
            setSelectedFormat('mp4');
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="videocam-outline"
            size={14}
            color={selectedFormat === 'mp4' ? '#FFFFFF' : colors.textMuted}
          />
          <Text
            style={[
              styles.formatPillText,
              selectedFormat === 'mp4' && styles.formatPillTextActive,
            ]}
          >
            MP4 VIDEO
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Void Singularity Canvas */}
      <View style={styles.centerStage}>
        <BlackHoleVisual
          onPress={handleHolePress}
          isSucking={isSucking}
          status={holeStatus}
        />

        {/* Dynamic Status / Feedback Area Below Hole */}
        <View style={styles.feedbackArea}>
          {holeStatus === 'resolving' ? (
            <Text style={styles.resolvingText}>EXTRACTING YOUTUBE STREAM</Text>
          ) : holeStatus === 'downloading' ? (
            <View style={styles.downloadingRow}>
              <Text style={styles.downloadingText}>
                {selectedFormat === 'mp3'
                  ? 'DOWNLOADING TO MP3 PLAYLIST'
                  : 'DOWNLOADING VIDEO'}
              </Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  cancelDownload();
                  setHoleStatus('idle');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : holeStatus === 'success' ? (
            <TouchableOpacity
              style={styles.successBox}
              onPress={() => navigation.navigate('Playlist')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.successText}>
                SAVED TO MP3 PLAYLIST • TAP TO LISTEN
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.success} />
            </TouchableOpacity>
          ) : errorMessage ? (
            <View style={styles.errorContainer}>
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText} numberOfLines={3}>{errorMessage}</Text>
              </View>
            </View>
          ) : feedbackMessage ? (
            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.hintText}>{feedbackMessage}</Text>
            </View>
          ) : (
            <Text style={styles.instructionText}>TAP SINGULARITY TO INGEST YOUTUBE LINK</Text>
          )}
        </View>
      </View>

      {/* Floating Mini-Player for continuous background audio control (tap opens full player) */}
      <GlobalMiniPlayer
        bottomOffset={Platform.OS === 'android' ? 84 : 96}
      />

      {/* Bottom Action Dock: Historique & Playlist side by side */}
      <View style={styles.bottomDock}>
        <TouchableOpacity
          style={styles.dockButton}
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.75}
        >
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.dockButtonText}>HISTORIQUE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockButton, styles.dockPlaylistButton]}
          onPress={() => navigation.navigate('Playlist')}
          activeOpacity={0.75}
        >
          <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
          <Text style={styles.dockPlaylistText}>PLAYLIST</Text>
        </TouchableOpacity>
      </View>

      {/* App Info Modal */}
      <AppInfoModal
        visible={isInfoModalVisible}
        onClose={() => setIsInfoModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  topHeaderLeftSpacer: {
    width: 32,
    height: 32,
  },
  topHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '900',
  },
  formatSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  formatPillActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: colors.accent,
  },
  formatPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formatPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackArea: {
    marginTop: 36,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  instructionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  resolvingText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadingText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  successText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A0E13',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    gap: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 8,
  },
  hintText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 10 : 18,
    paddingTop: 8,
  },
  dockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dockButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dockPlaylistButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  dockPlaylistText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
