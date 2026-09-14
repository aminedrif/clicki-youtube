import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { DownloadRecord } from '../database/types';
import { downloadRepository } from '../database/downloadRepository';
import {
  deleteLocalFile,
  shareFileAsync,
  triggerBrowserFileDownload,
} from '../services/fileService';
import { HistoryCard } from '../components/HistoryCard';
import { colors } from '../theme/colors';

type HistoryScreenProps = NativeStackScreenProps<RootStackParamList, 'History'>;

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await downloadRepository.getAll();
      setDownloads(records);
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (item: DownloadRecord) => {
    // Delete physical media and cached thumbnail
    await deleteLocalFile(item.file_path);
    if (item.thumbnail_local_path) {
      await deleteLocalFile(item.thumbnail_local_path);
    }
    // Delete from SQLite database
    await downloadRepository.deleteById(item.id);
    // Reload state
    setDownloads((prev) => prev.filter((d) => d.id !== item.id));
  };

  const handleShare = async (item: DownloadRecord) => {
    if (Platform.OS === 'web') {
      const cleanTitle = (item.title || 'video')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);
      const filename = `${cleanTitle}.mp4`;
      triggerBrowserFileDownload(item.file_path, filename);
    } else {
      await shareFileAsync(item.file_path, false);
    }
  };

  const handlePressItem = (item: DownloadRecord) => {
    navigation.navigate('Player', { downloadRecord: item });
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
          onPress={loadHistory}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Media History List */}
      {downloads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={54} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>Historique vide</Text>
          <Text style={styles.emptySubtitle}>
            Les vidéos téléchargées apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <HistoryCard
              item={item}
              onPress={handlePressItem}
              onDelete={handleDelete}
              onShare={handleShare}
            />
          )}
        />
      )}
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
  listContainer: {
    padding: 16,
    paddingBottom: 36,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
