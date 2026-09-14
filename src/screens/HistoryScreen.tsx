import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { DownloadRecord, SupportedPlatform } from '../database/types';
import { downloadRepository } from '../database/downloadRepository';
import { deleteLocalFile } from '../services/fileService';
import { HistoryCard } from '../components/HistoryCard';
import { colors } from '../theme/colors';

type HistoryScreenProps = NativeStackScreenProps<RootStackParamList, 'History'>;

const PLATFORM_FILTERS: { label: string; value: SupportedPlatform | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'X', value: 'twitter' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'Pinterest', value: 'pinterest' },
];

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [filteredDownloads, setFilteredDownloads] = useState<DownloadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<SupportedPlatform | 'all'>('all');
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

  // Filter based on search query and platform
  useEffect(() => {
    let result = downloads;

    if (selectedPlatform !== 'all') {
      result = result.filter((item) => item.platform === selectedPlatform);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.original_url.toLowerCase().includes(q)
      );
    }

    setFilteredDownloads(result);
  }, [downloads, searchQuery, selectedPlatform]);

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
        <Text style={styles.headerTitle}>DOWNLOAD ARCHIVE</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={loadHistory}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search saved videos..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Platform Filter Pills */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PLATFORM_FILTERS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const isSelected = selectedPlatform === item.value;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                ]}
                onPress={() => setSelectedPlatform(item.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Media History List */}
      {filteredDownloads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>Void is Empty</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || selectedPlatform !== 'all'
              ? 'No downloads match your filter.'
              : 'Media you download will be archived here for offline access.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDownloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <HistoryCard
              item={item}
              onPress={handlePressItem}
              onDelete={handleDelete}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  filtersWrapper: {
    marginVertical: 12,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accent,
  },
  filterPillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.textPrimary,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
