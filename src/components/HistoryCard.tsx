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
import { colors } from '../theme/colors';

interface HistoryCardProps {
  item: DownloadRecord;
  onPress: (item: DownloadRecord) => void;
  onDelete: (item: DownloadRecord) => void;
  onShare: (item: DownloadRecord) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onPress,
  onDelete,
  onShare,
}) => {
  const confirmDelete = () => {
    Alert.alert(
      'Delete Video',
      'Remove this video from your device?',
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

  return (
    <View style={styles.card}>
      {/* Video Preview / Tap to Play */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.thumbnailContainer}
        onPress={() => onPress(item)}
      >
        {item.thumbnail_local_path ? (
          <Image
            source={{ uri: item.thumbnail_local_path }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="videocam" size={38} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.playButtonCircle}>
          <Ionicons name="play" size={24} color="#FFFFFF" style={styles.playIcon} />
        </View>
      </TouchableOpacity>

      {/* Actions: ONLY Share and Delete */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.shareBtn}
          onPress={() => onShare(item)}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.shareText}>SHARE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.deleteBtn}
          onPress={confirmDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>DELETE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#0B0C10',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.surfaceElevated,
  },
  playButtonCircle: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  playIcon: {
    marginLeft: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  shareText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
