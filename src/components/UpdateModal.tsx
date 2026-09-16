import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import {
  UpdateInfo,
  subscribeToUpdateEvents,
  CURRENT_VERSION_CODE,
  CURRENT_VERSION_NAME,
} from '../services/updateChecker';

export const UpdateModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [status, setStatus] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUpdateEvents((info) => {
      setUpdateInfo(info);
      setVisible(true);
      setStatus('idle');
      setDownloadProgress(0);
      setErrorMessage(null);
    });

    return () => unsubscribe();
  }, []);

  if (!visible || !updateInfo) {
    return null;
  }

  const handleStartUpdate = async () => {
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      if (!updateInfo.downloadUrl) {
        throw new Error('Download URL is not provided.');
      }

      // If on iOS or not an Android APK, fallback to opening browser
      const isApkUrl = updateInfo.downloadUrl.toLowerCase().includes('.apk') || updateInfo.downloadUrl.includes('/releases/download/');
      if (Platform.OS !== 'android' || !isApkUrl) {
        Linking.openURL(updateInfo.downloadUrl).catch(() => {});
        setVisible(false);
        return;
      }

      setStatus('downloading');
      setErrorMessage(null);
      setDownloadProgress(0);

      const targetFile = `${FileSystem.documentDirectory}clicki_v${updateInfo.versionCode || 'new'}.apk`;

      // Check if already downloaded
      const fileInfo = await FileSystem.getInfoAsync(targetFile);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 1000000) {
        // Already downloaded, launch installer directly
        await launchApkInstaller(targetFile);
        return;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        targetFile,
        {},
        (progress) => {
          const total = progress.totalBytesExpectedToWrite;
          const written = progress.totalBytesWritten;
          setDownloadedBytes(written);
          setTotalBytes(total);
          if (total > 0) {
            const percent = written / total;
            setDownloadProgress(percent);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Failed to download update file.');
      }

      await launchApkInstaller(result.uri);
    } catch (err: any) {
      console.warn('In-app update download error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Download failed. Please try again.');
    }
  };

  const launchApkInstaller = async (apkUri: string) => {
    setStatus('installing');
    try {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(apkUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(apkUri, {
          mimeType: 'application/vnd.android.package-archive',
          dialogTitle: 'Install CLICKI Update',
        });
      }
    } catch (launchErr: any) {
      console.warn('Intent launcher error, falling back to Sharing:', launchErr);
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(apkUri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: 'Install CLICKI Update',
          });
        } else {
          Linking.openURL(updateInfo.downloadUrl).catch(() => {});
        }
      } catch (shareErr) {
        Linking.openURL(updateInfo.downloadUrl).catch(() => {});
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (status !== 'downloading' && !updateInfo.forceUpdate) {
          setVisible(false);
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Accent Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconPulse}>
              <Ionicons name="rocket-sharp" size={28} color="#00E5FF" />
            </View>
          </View>

          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              NEW UPDATE • v{updateInfo.version || 'Latest'}
            </Text>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.subtitle}>
            A newer version of CLICKI Youtube is ready with enhancements & bug fixes.
          </Text>

          {/* Changelog Box */}
          {updateInfo.changelog ? (
            <View style={styles.changelogBox}>
              <Text style={styles.changelogHeader}>WHAT'S NEW</Text>
              <Text style={styles.changelogText}>{updateInfo.changelog}</Text>
            </View>
          ) : null}

          {/* Download Progress / Status */}
          {status === 'downloading' ? (
            <View style={styles.progressSection}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.max(5, Math.round(downloadProgress * 100))}%` },
                  ]}
                />
              </View>
              <View style={styles.progressStatsRow}>
                <Text style={styles.progressPercentText}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
                <Text style={styles.progressBytesText}>
                  {totalBytes > 0
                    ? `${formatSize(downloadedBytes)} / ${formatSize(totalBytes)}`
                    : 'Downloading...'}
                </Text>
              </View>
            </View>
          ) : status === 'installing' ? (
            <View style={styles.installingBox}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={styles.installingText}>Opening Android Installer...</Text>
            </View>
          ) : status === 'error' ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage || 'Download error'}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {!updateInfo.forceUpdate && status !== 'downloading' && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={() => setVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.updateButton,
                status === 'downloading' && styles.updateButtonDisabled,
              ]}
              onPress={handleStartUpdate}
              disabled={status === 'downloading'}
              activeOpacity={0.8}
            >
              {status === 'downloading' ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.updateButtonText}>
                  {status === 'error' ? 'Retry Update' : 'Update Now'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F0F12',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222228',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  badgeText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  changelogBox: {
    width: '100%',
    backgroundColor: '#16161C',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262630',
    marginBottom: 16,
  },
  changelogHeader: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  changelogText: {
    color: '#D1D1D6',
    fontSize: 12,
    lineHeight: 17,
  },
  progressSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#222228',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 4,
  },
  progressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBytesText: {
    color: '#8E8E93',
    fontSize: 11,
  },
  installingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  installingText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  laterButton: {
    flex: 1,
    backgroundColor: '#1E1E24',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2E2E38',
  },
  laterButtonText: {
    color: '#A1A1A8',
    fontSize: 14,
    fontWeight: '600',
  },
  updateButton: {
    flex: 2,
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
