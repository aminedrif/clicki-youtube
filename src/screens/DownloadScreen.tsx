import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { formatBytes, triggerBrowserFileDownload, shareFileAsync } from '../services/fileService';
import { showInterstitialOnDownloadComplete } from '../services/adMobService';
import { colors } from '../theme/colors';

type DownloadScreenProps = NativeStackScreenProps<RootStackParamList, 'Download'>;

export const DownloadScreen: React.FC<DownloadScreenProps> = ({
  route,
  navigation,
}) => {
  const { resolveData, selectedQuality, selectedFormat, targetUrl } = route.params;
  const { downloadState, startDownload, cancelDownload } = useDownloadManager();
  const [hasTriggeredAd, setHasTriggeredAd] = useState(false);

  useEffect(() => {
    // Initiate streaming download
    startDownload(resolveData, selectedQuality, selectedFormat, targetUrl);
  }, []);

  // When download completes successfully, trigger interstitial test ad
  useEffect(() => {
    if (downloadState.completedRecord && !hasTriggeredAd) {
      setHasTriggeredAd(true);
      showInterstitialOnDownloadComplete().catch(() => {});
    }
  }, [downloadState.completedRecord, hasTriggeredAd]);

  const percentage = Math.min(100, Math.round(downloadState.progress * 100));

  const handleSaveToLocalDevice = () => {
    if (downloadState.completedRecord) {
      const url = downloadState.completedRecord.file_path;
      const cleanTitle = (downloadState.completedRecord.title || 'video')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);
      const ext = downloadState.completedRecord.format.toLowerCase().includes('mp3')
        ? '.mp3'
        : '.mp4';
      const filename = `${cleanTitle}${ext}`;

      triggerBrowserFileDownload(url, filename);
    }
  };

  const handleShareOrSaveToFiles = async () => {
    if (downloadState.completedRecord?.file_path) {
      await shareFileAsync(
        downloadState.completedRecord.file_path,
        Boolean(downloadState.isAudio)
      );
    }
  };

  const handlePlayNow = () => {
    if (downloadState.completedRecord) {
      navigation.replace('Player', {
        downloadRecord: downloadState.completedRecord,
      });
    }
  };

  const handleGoHome = () => {
    navigation.popToTop();
  };

  const handleGoHistory = () => {
    navigation.replace('History');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DOWNLOADING MEDIA</Text>
      </View>

      <View style={styles.content}>
        {downloadState.isDownloading ? (
          /* Active Streaming State */
          <View style={styles.stateCard}>
            <View style={styles.cosmicRingContainer}>
              <View style={styles.cosmicRingOuter}>
                <ActivityIndicator size="large" color={colors.glowViolet} />
              </View>
              <Text style={styles.percentageText}>{percentage}%</Text>
            </View>

            <Text style={styles.mediaTitle} numberOfLines={2}>
              {resolveData.title || 'Downloading media...'}
            </Text>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${percentage}%` },
                ]}
              />
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {formatBytes(downloadState.bytesWritten)}
                {downloadState.totalBytes > 0
                  ? ` / ${formatBytes(downloadState.totalBytes)}`
                  : ''}
              </Text>
              <Text style={styles.statsText}>{selectedQuality}</Text>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelDownload}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.cancelButtonText}>CANCEL STREAM</Text>
            </TouchableOpacity>
          </View>
        ) : downloadState.completedRecord ? (
          /* Download Success State */
          <View style={styles.stateCard}>
            <View style={styles.successIconBox}>
              <Ionicons
                name={downloadState.savedToGallery ? 'checkmark-circle' : 'file-tray-full'}
                size={64}
                color={downloadState.savedToGallery ? colors.success : colors.glowViolet}
              />
            </View>

            <Text style={styles.successTitle}>
              {Platform.OS === 'web'
                ? 'DOWNLOAD COMPLETE'
                : downloadState.savedToGallery
                ? 'SAVED TO PHOTOS'
                : 'SAVED TO APP STORAGE'}
            </Text>
            <Text style={styles.successSubtitle}>
              {Platform.OS === 'web'
                ? 'Your file has been sent to your browser downloads.'
                : downloadState.savedToGallery
                ? 'Your video has been saved directly to your iPhone Camera Roll.'
                : downloadState.isAudio
                ? 'Audio file saved locally. Tap below if you want to save to Files or share.'
                : 'Video saved to device storage. Tap below to share or save to Files.'}
            </Text>

            <View style={styles.actionButtonsCol}>
              {Platform.OS === 'web' ? (
                <TouchableOpacity
                  style={styles.saveFileBtn}
                  onPress={handleSaveToLocalDevice}
                  activeOpacity={0.8}
                  {...((downloadState.completedRecord?.file_path || targetUrl)
                    ? {
                        accessibilityRole: 'link',
                        href: downloadState.completedRecord?.file_path || targetUrl,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }
                    : {})}
                >
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveFileBtnText}>DOWNLOAD FILE TO PC AGAIN</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {downloadState.permissionDenied && (
                    <TouchableOpacity
                      style={styles.openSettingsBtn}
                      onPress={() => Linking.openSettings()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.openSettingsBtnText}>ALLOW PHOTOS IN SETTINGS</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.saveFileBtn}
                    onPress={handleShareOrSaveToFiles}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.saveFileBtnText}>SAVE TO FILES / SHARE</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleGoHome}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back-circle-outline" size={20} color="#000000" />
                <Text style={styles.primaryActionBtnText}>INGEST ANOTHER LINK</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={handleGoHistory}
                activeOpacity={0.8}
              >
                <Ionicons name="folder-open-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.secondaryActionBtnText}>VIEW IN HISTORY</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.minimalActionBtn}
                onPress={handlePlayNow}
                activeOpacity={0.8}
              >
                <Text style={styles.minimalActionBtnText}>Preview Media</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Download Failure / Cancelled State */
          <View style={styles.stateCard}>
            <View style={styles.errorIconBox}>
              <Ionicons name="alert-circle" size={64} color={colors.danger} />
            </View>

            <Text style={styles.errorTitle}>DOWNLOAD INTERRUPTED</Text>
            <Text style={styles.errorSubtitle}>
              {downloadState.error || 'Failed to stream media to storage.'}
            </Text>

            <View style={styles.actionButtonsCol}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() =>
                  startDownload(resolveData, selectedQuality, selectedFormat, targetUrl)
                }
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#000000" />
                <Text style={styles.primaryActionBtnText}>RETRY DOWNLOAD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={handleGoHome}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionBtnText}>BACK TO HOLE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cosmicRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  cosmicRingOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    position: 'absolute',
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  mediaTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  successIconBox: {
    marginVertical: 16,
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  successSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
  },
  errorIconBox: {
    marginVertical: 16,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  errorSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
  },
  actionButtonsCol: {
    width: '100%',
    gap: 12,
  },
  saveFileBtn: {
    backgroundColor: colors.glowViolet,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.glowViolet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  saveFileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  openSettingsBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  openSettingsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryActionBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  secondaryActionBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  minimalActionBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  minimalActionBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
