import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DownloadRecord } from '../database/types';
import { PlatformBadge } from './PlatformBadge';
import { formatBytes } from '../services/fileService';
import { colors } from '../theme/colors';

interface HistoryCardProps {
  item: DownloadRecord;
  onPress: (item: DownloadRecord) => void;
  onDelete: (item: DownloadRecord) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onPress,
  onDelete,
}) => {
  const formattedDate = new Date(item.downloaded_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete Download',
      'Remove this video from your device and history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(item),
        },
      ]
    );
  };

  const isAudio = item.format.toLowerCase().includes('mp3');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.container}
      onPress={() => onPress(item)}
    >
      <View style={styles.thumbnailContainer}>
        {item.thumbnail_local_path ? (
          <Image
            source={{ uri: item.thumbnail_local_path }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name={isAudio ? 'musical-notes' : 'videocam'}
              size={24}
              color={colors.textMuted}
            />
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={14} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.topRow}>
          <PlatformBadge platform={item.platform} size="small" />
          <TouchableOpacity
            onPress={confirmDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.quality}</Text>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.metaText}>{formatBytes(item.file_size)}</Text>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.metaText}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deleteButton: {
    padding: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bullet: {
    fontSize: 11,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
});
