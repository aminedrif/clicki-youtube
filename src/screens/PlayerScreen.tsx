import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../navigation/types';
import { PlatformBadge } from '../components/PlatformBadge';
import { downloadRepository } from '../database/downloadRepository';
import { deleteLocalFile, formatBytes, triggerBrowserFileDownload } from '../services/fileService';
import { colors } from '../theme/colors';

type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
  route,
  navigation,
}) => {
  const { downloadRecord } = route.params;

  // Initialize expo-video player with local file URI
  const player = useVideoPlayer(downloadRecord.file_path, (p) => {
    p.loop = true;
    p.play();
  });

  const handleSaveToDevice = () => {
    const url = downloadRecord.file_path;
    const cleanTitle = (downloadRecord.title || 'video')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 50);
    const ext = downloadRecord.format.toLowerCase().includes('mp3') ? '.mp3' : '.mp4';
    const filename = `${cleanTitle}${ext}`;

    if (Platform.OS === 'web') {
      triggerBrowserFileDownload(url, filename);
    } else {
      handleShare();
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this platform.');
        return;
      }
      await Sharing.shareAsync(downloadRecord.file_path);
    } catch (error: any) {
      Alert.alert('Share Failed', error.message || 'Unable to share video.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Download',
      'Remove this video from your device and history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            player.pause();
            await deleteLocalFile(downloadRecord.file_path);
            if (downloadRecord.thumbnail_local_path) {
              await deleteLocalFile(downloadRecord.thumbnail_local_path);
            }
            await downloadRepository.deleteById(downloadRecord.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const formattedDate = new Date(downloadRecord.downloaded_at).toLocaleString();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MEDIA PLAYER</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={Platform.OS === 'web' ? handleSaveToDevice : handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={Platform.OS === 'web' ? 'download-outline' : 'share-outline'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Native Video Playback View */}
        <View style={styles.videoWrapper}>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            nativeControls
            contentFit="contain"
          />
        </View>

        {/* Media Metadata & Action Details */}
        <View style={styles.detailsCard}>
          <View style={styles.metaTopRow}>
            <PlatformBadge platform={downloadRecord.platform} size="medium" />
            <Text style={styles.sizePill}>{formatBytes(downloadRecord.file_size)}</Text>
          </View>

          <Text style={styles.videoTitle}>{downloadRecord.title}</Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>FORMAT / QUALITY</Text>
              <Text style={styles.metaItemValue}>
                {downloadRecord.format.toUpperCase()} • {downloadRecord.quality}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>DOWNLOADED AT</Text>
              <Text style={styles.metaItemValue}>{formattedDate}</Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>ORIGINAL SOURCE LINK</Text>
              <Text style={styles.metaItemLink} numberOfLines={2} selectable>
                {downloadRecord.original_url}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>LOCAL FILE PATH</Text>
              <Text style={styles.metaItemPath} numberOfLines={1} selectable>
                {downloadRecord.file_path}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            {Platform.OS === 'web' ? (
              <TouchableOpacity
                style={styles.saveActionBtn}
                onPress={handleSaveToDevice}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveActionText}>SAVE FILE TO PC</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.shareActionBtn}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={18} color="#000000" />
                <Text style={styles.shareActionText}>SHARE FILE</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteActionText}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  videoWrapper: {
    width: '100%',
    height: 280,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  detailsCard: {
    padding: 20,
  },
  metaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizePill: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  videoTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 20,
  },
  metaGrid: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 16,
    marginBottom: 24,
  },
  metaItem: {},
  metaItemLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaItemValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  metaItemLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  metaItemPath: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveActionBtn: {
    flex: 2,
    backgroundColor: colors.glowViolet,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareActionBtn: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareActionText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
