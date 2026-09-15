import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { PlatformBadge } from '../components/PlatformBadge';
import { QualitySelector } from '../components/QualitySelector';
import { BlackHoleVisual } from '../components/BlackHoleVisual';
import { downloadRepository } from '../database/downloadRepository';
import { triggerBrowserFileDownload } from '../services/fileService';
import { showInterstitialOnDownloadClick } from '../services/adMobService';
import { colors } from '../theme/colors';

type PreviewScreenProps = NativeStackScreenProps<RootStackParamList, 'Preview'>;

export const PreviewScreen: React.FC<PreviewScreenProps> = ({
  route,
  navigation,
}) => {
  const { resolveData } = route.params;

  const [selectedFormat, setSelectedFormat] = useState<'mp4' | 'mp3'>(
    resolveData.audioOnlyAvailable ? 'mp3' : 'mp4'
  );
  const [selectedQuality, setSelectedQuality] = useState<string>(
    resolveData.availableQualities && resolveData.availableQualities.length > 0
      ? resolveData.availableQualities[0]
      : 'Auto'
  );
  const [selectedPickerItemIndex, setSelectedPickerItemIndex] = useState<number>(0);

  // Determine media URL to download
  const isPicker = resolveData.status === 'picker' && resolveData.picker && resolveData.picker.length > 0;
  const currentTargetUrl = isPicker
    ? resolveData.picker![selectedPickerItemIndex]?.url
    : resolveData.url || resolveData.originalUrl;

  const activeThumbnail = isPicker
    ? resolveData.picker![selectedPickerItemIndex]?.thumb || resolveData.thumbnail
    : resolveData.thumbnail;

  const handleStartDownload = () => {
    showInterstitialOnDownloadClick().catch(() => {});
    navigateToDownload();
  };

  const navigateToDownload = () => {
    navigation.navigate('Download', {
      resolveData,
      selectedQuality,
      selectedFormat,
      targetUrl: currentTargetUrl,
    });
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
        <Text style={styles.headerTitle}>RESOLVED MEDIA</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Preview Card */}
        <View style={styles.card}>
          <View style={styles.thumbnailContainer}>
            {activeThumbnail ? (
              <Image
                source={{ uri: activeThumbnail }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="film-outline" size={48} color={colors.textMuted} />
              </View>
            )}

            {/* Platform overlay badge */}
            <View style={styles.platformBadgeOverlay}>
              <PlatformBadge platform={resolveData.platform} size="medium" />
            </View>
          </View>

          <View style={styles.mediaDetails}>
            <Text style={styles.mediaTitle} numberOfLines={2}>
              {resolveData.title || 'Untitled Social Media Post'}
            </Text>

            {resolveData.duration && (
              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.durationText}>
                  {Math.floor(resolveData.duration / 60)}:
                  {(resolveData.duration % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Carousel / Picker selection if multi-item */}
        {isPicker && (
          <View style={styles.pickerSection}>
            <Text style={styles.sectionHeader}>
              CAROUSEL ITEMS ({resolveData.picker!.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {resolveData.picker!.map((item, idx) => {
                const isSelected = selectedPickerItemIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPickerItemIndex(idx)}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected,
                    ]}
                  >
                    {item.thumb ? (
                      <Image source={{ uri: item.thumb }} style={styles.pickerThumb} />
                    ) : (
                      <View style={styles.pickerPlaceholder}>
                        <Text style={styles.pickerNumber}>#{idx + 1}</Text>
                      </View>
                    )}
                    <Text style={styles.pickerTypeLabel}>{item.type}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Format & Quality Selector */}
        <QualitySelector
          selectedId={selectedQuality}
          onSelect={(option) => {
            setSelectedQuality(option.quality);
            setSelectedFormat('mp4');
          }}
        />

        {/* Download Action CTA with Animated Black Hole Logo */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.downloadButton}
          onPress={handleStartDownload}
          {...(Platform.OS === 'web' && currentTargetUrl
            ? {
                accessibilityRole: 'link',
                href: currentTargetUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
              }
            : {})}
        >
          <View style={styles.downloadButtonHoleBadge}>
            <BlackHoleVisual size={34} showLabel={false} disabled />
          </View>
          <Text style={styles.downloadButtonText}>START DOWNLOAD</Text>
          <Ionicons name="arrow-down" size={18} color={colors.accent} />
        </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 16,
  },
  thumbnailContainer: {
    width: '100%',
    height: 220,
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
  platformBadgeOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  mediaDetails: {
    padding: 16,
  },
  mediaTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  pickerSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
  },
  pickerItem: {
    width: 80,
    height: 90,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    borderColor: colors.accent,
  },
  pickerThumb: {
    width: '100%',
    height: 65,
  },
  pickerPlaceholder: {
    width: '100%',
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2028',
  },
  pickerNumber: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerTypeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  downloadButton: {
    backgroundColor: '#070C18',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  downloadButtonHoleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
