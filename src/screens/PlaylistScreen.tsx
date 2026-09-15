import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { RootStackParamList } from '../navigation/types';
import { DownloadRecord, PlaylistRecord } from '../database/types';
import { downloadRepository } from '../database/downloadRepository';
import {
  deleteLocalFile,
  shareFileAsync,
  triggerBrowserFileDownload,
} from '../services/fileService';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

type PlaylistScreenProps = NativeStackScreenProps<RootStackParamList, 'Playlist'>;

export const PlaylistScreen: React.FC<PlaylistScreenProps> = ({ navigation }) => {
  // Navigation tabs: 'all' (all downloaded songs), 'playlists' (user-created folders), 'detail' (inside a playlist)
  const [activeTab, setActiveTab] = useState<'all' | 'playlists' | 'detail'>('all');
  const [allTracks, setAllTracks] = useState<DownloadRecord[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<DownloadRecord[]>([]);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; created_at: number; cover_url: string | null; track_count: number }>>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string; created_at: number; cover_url: string | null; track_count: number } | null>(null);
  const [playlistDetailTracks, setPlaylistDetailTracks] = useState<DownloadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Global Audio Player Context (persists across screens and in background)
  const {
    currentTrack,
    isPlaying,
    playbackTime,
    duration,
    playTrack: playTrackGlobal,
    togglePlayPause,
    nextTrack: handleNextTrack,
    prevTrack: handlePrevTrack,
    seekTo,
    dismissPlayer,
  } = useAudioPlayer();

  // Modals
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<DownloadRecord | null>(null);
  const [assignedPlaylistIds, setAssignedPlaylistIds] = useState<string[]>([]);

  // Load all MP3 tracks (STRICTLY MP3, NO VIDEOS)
  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await downloadRepository.getMp3sOnly();
      setAllTracks(records);
      setFilteredTracks(records);

      const pls = await downloadRepository.getAllPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.warn('Failed to load MP3 tracks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // Load tracks for the selected playlist
  const loadPlaylistDetail = useCallback(async (playlistId: string) => {
    try {
      const tracks = await downloadRepository.getPlaylistTracks(playlistId);
      setPlaylistDetailTracks(tracks);
    } catch (err) {
      console.warn('Failed to load playlist tracks:', err);
    }
  }, []);

  // Handle Search Query changes with live filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTracks(allTracks);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const filtered = allTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.original_url.toLowerCase().includes(q) ||
        (t.quality && t.quality.toLowerCase().includes(q))
    );
    setFilteredTracks(filtered);
  }, [searchQuery, allTracks]);

  const getActiveQueue = (): DownloadRecord[] => {
    if (activeTab === 'detail' && playlistDetailTracks.length > 0) {
      return playlistDetailTracks;
    }
    return filteredTracks.length > 0 ? filteredTracks : allTracks;
  };

  const playTrack = (track: DownloadRecord) => {
    const queue = getActiveQueue();
    playTrackGlobal(track, queue);
  };

  const handleSeek = (progress: number) => {
    if (duration <= 0) return;
    seekTo(progress * duration);
  };

  const handleDelete = async (item: DownloadRecord) => {
    Alert.alert(
      'Delete Track',
      `Delete "${item.title}" from your device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (currentTrack?.id === item.id) {
              dismissPlayer();
            }
            await deleteLocalFile(item.file_path);
            if (item.thumbnail_local_path) {
              await deleteLocalFile(item.thumbnail_local_path);
            }
            await downloadRepository.deleteById(item.id);
            setAllTracks((prev) => prev.filter((t) => t.id !== item.id));
            setFilteredTracks((prev) => prev.filter((t) => t.id !== item.id));
            setPlaylistDetailTracks((prev) => prev.filter((t) => t.id !== item.id));
            loadTracks();
          },
        },
      ]
    );
  };

  const handleShare = async (item: DownloadRecord) => {
    if (Platform.OS === 'web') {
      const cleanTitle = (item.title || 'audio')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);
      const filename = `${cleanTitle}.mp3`;
      triggerBrowserFileDownload(item.file_path, filename);
    } else {
      await shareFileAsync(item.file_path, true);
    }
  };

  // --- Playlist Creation ---
  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) return;
    try {
      await downloadRepository.createPlaylist(newPlaylistTitle.trim());
      setNewPlaylistTitle('');
      setIsCreateModalVisible(false);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      await loadTracks();
    } catch (err) {
      console.warn('Failed to create playlist:', err);
    }
  };

  const handleDeletePlaylist = (playlist: { id: string; name: string }) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"? (Songs will remain in your library)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await downloadRepository.deletePlaylist(playlist.id);
            if (selectedPlaylist?.id === playlist.id) {
              setSelectedPlaylist(null);
              setActiveTab('playlists');
            }
            await loadTracks();
          },
        },
      ]
    );
  };

  // Open "Add to Playlist" sheet
  const openAddToPlaylist = async (track: DownloadRecord) => {
    setTrackForPlaylist(track);
    try {
      const ids = await downloadRepository.getTrackPlaylistIds(track.id);
      setAssignedPlaylistIds(ids);
    } catch {
      setAssignedPlaylistIds([]);
    }
    setIsAddModalVisible(true);
  };

  const toggleTrackInPlaylist = async (playlistId: string) => {
    if (!trackForPlaylist) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const isAssigned = assignedPlaylistIds.includes(playlistId);
    if (isAssigned) {
      await downloadRepository.removeTrackFromPlaylist(playlistId, trackForPlaylist.id);
      setAssignedPlaylistIds((prev) => prev.filter((id) => id !== playlistId));
    } else {
      await downloadRepository.addTrackToPlaylist(playlistId, trackForPlaylist.id);
      setAssignedPlaylistIds((prev) => [...prev, playlistId]);
    }
    // Refresh playlists counts
    const pls = await downloadRepository.getAllPlaylists();
    setPlaylists(pls);
    if (selectedPlaylist?.id === playlistId) {
      loadPlaylistDetail(playlistId);
    }
  };

  const openPlaylistDetail = (playlist: { id: string; name: string; created_at: number; cover_url: string | null; track_count: number }) => {
    setSelectedPlaylist(playlist);
    loadPlaylistDetail(playlist.id);
    setActiveTab('detail');
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressFraction = duration > 0 ? playbackTime / duration : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (activeTab === 'detail') {
              setActiveTab('playlists');
              setSelectedPlaylist(null);
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeTab === 'detail' && selectedPlaylist ? selectedPlaylist.name : 'MP3 PLAYLIST'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'detail'
              ? `${playlistDetailTracks.length} TRACKS`
              : activeTab === 'playlists'
              ? `${playlists.length} PLAYLISTS`
              : `${allTracks.length} DOWNLOADED TRACKS`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            loadTracks();
            if (selectedPlaylist) loadPlaylistDetail(selectedPlaylist.id);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Spotify-Style View Selector Pills */}
      {activeTab !== 'detail' && (
        <View style={styles.tabPillRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="musical-notes"
              size={14}
              color={activeTab === 'all' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.tabPillText, activeTab === 'all' && styles.tabPillTextActive]}>
              All Tracks ({allTracks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'playlists' && styles.tabPillActive]}
            onPress={() => setActiveTab('playlists')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="folder"
              size={14}
              color={activeTab === 'playlists' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.tabPillText, activeTab === 'playlists' && styles.tabPillTextActive]}>
              Playlists ({playlists.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabNewPill}
            onPress={() => setIsCreateModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.tabNewPillText}>New</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIEW 1: ALL TRACKS */}
      {activeTab === 'all' && (
        <>
          {/* Live Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tracks or artists..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Track List */}
          {filteredTracks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={60} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'No Matching Tracks' : 'No MP3 Tracks Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? `No downloaded tracks match "${searchQuery}".`
                  : 'Ingest YouTube links on the home screen to build your music library.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredTracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                currentTrack && { paddingBottom: 110 },
              ]}
              renderItem={({ item }) => {
                const isSelected = currentTrack?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.trackRow, isSelected && styles.trackRowActive]}
                    onPress={() => playTrack(item)}
                    activeOpacity={0.75}
                  >
                    {/* Thumbnail Artwork */}
                    <View style={styles.thumbWrapper}>
                      {item.thumbnail_local_path ? (
                        <Image source={{ uri: item.thumbnail_local_path }} style={styles.thumbImage} />
                      ) : (
                        <View style={styles.thumbFallback}>
                          <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
                        </View>
                      )}
                      {isSelected && isPlaying && (
                        <View style={styles.playingOverlay}>
                          <Ionicons name="volume-high" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    {/* Metadata */}
                    <View style={styles.trackInfo}>
                      <Text style={[styles.trackTitle, isSelected && styles.trackTitleActive]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaBadge}>{item.quality || '320kbps'}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaSize}>{(item.file_size / (1024 * 1024)).toFixed(1)} MB</Text>
                      </View>
                    </View>

                    {/* Action Buttons: Add to Playlist, Share, Delete */}
                    <View style={styles.trackActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openAddToPlaylist(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleShare(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}

      {/* VIEW 2: PLAYLISTS (SPOTIFY STYLE) */}
      {activeTab === 'playlists' && (
        <View style={{ flex: 1 }}>
          {playlists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={60} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Playlists Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create custom playlists (like "Favorites", "Gym", or "Chill") to organize your downloaded tracks.
              </Text>
              <TouchableOpacity
                style={styles.createFirstBtn}
                onPress={() => setIsCreateModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.createFirstBtnText}>Create Playlist</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(p) => p.id}
              contentContainerStyle={[styles.listContent, currentTrack && { paddingBottom: 110 }]}
              renderItem={({ item: playlist }) => (
                <TouchableOpacity
                  style={styles.playlistCard}
                  onPress={() => openPlaylistDetail(playlist)}
                  activeOpacity={0.75}
                >
                  <View style={styles.playlistCardCover}>
                    <Ionicons name="musical-notes" size={28} color={colors.accent} />
                  </View>

                  <View style={styles.playlistCardBody}>
                    <Text style={styles.playlistCardTitle} numberOfLines={1}>
                      {playlist.name}
                    </Text>
                    <Text style={styles.playlistCardCount}>
                      {playlist.track_count} {playlist.track_count === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.playlistDeleteBtn}
                    onPress={() => handleDeletePlaylist(playlist)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* VIEW 3: PLAYLIST DETAIL */}
      {activeTab === 'detail' && selectedPlaylist && (
        <View style={{ flex: 1 }}>
          {/* Detail Banner */}
          <View style={styles.detailBanner}>
            <View style={styles.detailCover}>
              <Ionicons name="musical-notes" size={36} color="#FFFFFF" />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailTitle}>{selectedPlaylist.name}</Text>
              <Text style={styles.detailSub}>{playlistDetailTracks.length} tracks in this playlist</Text>
              {playlistDetailTracks.length > 0 && (
                <TouchableOpacity
                  style={styles.playAllBtn}
                  onPress={() => playTrack(playlistDetailTracks[0])}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={16} color="#FFFFFF" />
                  <Text style={styles.playAllText}>PLAY ALL</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tracks inside playlist */}
          {playlistDetailTracks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="disc-outline" size={54} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>Playlist is Empty</Text>
              <Text style={styles.emptySubtitle}>
                Go to "All Tracks" and tap [+] on any downloaded song to add it here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={playlistDetailTracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.listContent, currentTrack && { paddingBottom: 110 }]}
              renderItem={({ item }) => {
                const isSelected = currentTrack?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.trackRow, isSelected && styles.trackRowActive]}
                    onPress={() => playTrack(item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.thumbWrapper}>
                      {item.thumbnail_local_path ? (
                        <Image source={{ uri: item.thumbnail_local_path }} style={styles.thumbImage} />
                      ) : (
                        <View style={styles.thumbFallback}>
                          <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
                        </View>
                      )}
                      {isSelected && isPlaying && (
                        <View style={styles.playingOverlay}>
                          <Ionicons name="volume-high" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <View style={styles.trackInfo}>
                      <Text style={[styles.trackTitle, isSelected && styles.trackTitleActive]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.metaSize}>{(item.file_size / (1024 * 1024)).toFixed(1)} MB</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={async () => {
                        await downloadRepository.removeTrackFromPlaylist(selectedPlaylist.id, item.id);
                        loadPlaylistDetail(selectedPlaylist.id);
                        loadTracks();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Floating Mini-Player at bottom */}
      {currentTrack && (
        <View style={styles.miniPlayerContainer}>
          {/* Progress Bar (interactive scrubber) */}
          <TouchableOpacity
            style={styles.progressBarBg}
            activeOpacity={1}
            onPress={(e) => {
              const tapX = e.nativeEvent.locationX;
              const ratio = Math.max(0, Math.min(1, tapX / (width - 24)));
              handleSeek(ratio);
            }}
          >
            <View style={[styles.progressBarFill, { width: `${progressFraction * 100}%` }]} />
          </TouchableOpacity>

          <View style={styles.miniPlayerRow}>
            {/* Artwork thumbnail */}
            <TouchableOpacity onPress={togglePlayPause} activeOpacity={0.8} style={styles.miniArtworkWrapper}>
              {currentTrack.thumbnail_local_path ? (
                <Image source={{ uri: currentTrack.thumbnail_local_path }} style={styles.miniArtwork} />
              ) : (
                <View style={styles.miniArtworkFallback}>
                  <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Song title & time */}
            <View style={styles.miniTrackText}>
              <Text style={styles.miniTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.miniTime}>
                {formatTime(playbackTime)} / {formatTime(duration)}
              </Text>
            </View>

            {/* Playback Controls */}
            <View style={styles.miniControls}>
              <TouchableOpacity onPress={handlePrevTrack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="play-skip-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                style={styles.miniPlayBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNextTrack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL 1: CREATE PLAYLIST */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Give your playlist a name..."
              placeholderTextColor={colors.textMuted}
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCreateModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !newPlaylistTitle.trim() && { opacity: 0.5 }]}
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistTitle.trim()}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: ADD TRACK TO PLAYLIST (SPOTIFY STYLE) */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalBackdropBottom}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add to Playlist</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {trackForPlaylist && (
              <Text style={styles.sheetTrackTitle} numberOfLines={1}>
                {trackForPlaylist.title}
              </Text>
            )}

            {/* Quick New Playlist row */}
            <TouchableOpacity
              style={styles.sheetNewRow}
              onPress={() => {
                setIsAddModalVisible(false);
                setIsCreateModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={24} color={colors.accent} />
              <Text style={styles.sheetNewText}>+ Create New Playlist</Text>
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: 260 }}>
              {playlists.length === 0 ? (
                <Text style={styles.sheetEmpty}>No playlists created yet. Create one above!</Text>
              ) : (
                playlists.map((pl) => {
                  const isAssigned = assignedPlaylistIds.includes(pl.id);
                  return (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.sheetPlaylistRow}
                      onPress={() => toggleTrackInPlaylist(pl.id)}
                    >
                      <Ionicons
                        name={isAssigned ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isAssigned ? colors.accent : colors.textMuted}
                      />
                      <Text style={[styles.sheetPlaylistName, isAssigned && styles.sheetPlaylistNameActive]}>
                        {pl.name}
                      </Text>
                      <Text style={styles.sheetPlaylistCount}>({pl.track_count})</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  refreshButton: {
    padding: 4,
  },
  tabPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#0A0E17',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: colors.accent,
  },
  tabPillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabNewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.accent,
    marginLeft: 'auto',
  },
  tabNewPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0E17',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 23, 0.7)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackRowActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  thumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trackTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  trackTitleActive: {
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaBadge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  metaDot: {
    color: colors.textMuted,
    marginHorizontal: 5,
    fontSize: 10,
  },
  metaSize: {
    color: colors.textMuted,
    fontSize: 10,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 60,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  createFirstBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 23, 0.8)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  playlistCardCover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistCardBody: {
    flex: 1,
    marginLeft: 14,
  },
  playlistCardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  playlistCardCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  playlistDeleteBtn: {
    padding: 6,
  },
  detailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  detailCover: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInfo: {
    flex: 1,
    marginLeft: 14,
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  detailSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 8,
  },
  playAllText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  miniPlayerContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#0A0E17',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  miniPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  miniArtworkWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  miniArtwork: {
    width: '100%',
    height: '100%',
  },
  miniArtworkFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTrackText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  miniTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  miniTime: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#020617',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalBackdropBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  sheetTrackTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 14,
  },
  sheetNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  sheetNewText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetPlaylistName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sheetPlaylistNameActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  sheetPlaylistCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sheetEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 20,
  },
});
