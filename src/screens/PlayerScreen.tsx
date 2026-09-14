import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../navigation/types';
import { downloadRepository } from '../database/downloadRepository';
import { deleteLocalFile, triggerBrowserFileDownload } from '../services/fileService';
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
    const filename = `${cleanTitle}.mp4`;

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
      'Delete Video',
      'Remove this video from your device?',
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
        <Text style={styles.headerTitle}>HISTORIQUE</Text>
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

      <View style={styles.content}>
        {/* Native Video Playback View */}
        <View style={styles.videoWrapper}>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            nativeControls
            contentFit="contain"
          />
        </View>

        {/* Actions: ONLY Share and Delete */}
        <View style={styles.actionsContainer}>
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              style={styles.shareActionBtn}
              onPress={handleSaveToDevice}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.shareActionText}>SAVE FILE TO PC</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.shareActionBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social" size={20} color="#000000" />
              <Text style={styles.shareActionText}>SHARE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteActionBtn}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={styles.deleteActionText}>DELETE</Text>
          </TouchableOpacity>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 36,
  },
  videoWrapper: {
    width: '100%',
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  shareActionBtn: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  shareActionText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteActionText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
