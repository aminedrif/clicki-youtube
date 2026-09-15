import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, View } from 'react-native';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { DownloadRecord } from '../database/types';

export interface AudioPlayerContextType {
  player: VideoPlayer | null;
  currentTrack: DownloadRecord | null;
  isPlaying: boolean;
  playbackTime: number;
  duration: number;
  queue: DownloadRecord[];
  playTrack: (track: DownloadRecord, newQueue?: DownloadRecord[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  dismissPlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  player: null,
  currentTrack: null,
  isPlaying: false,
  playbackTime: 0,
  duration: 0,
  queue: [],
  playTrack: () => {},
  togglePlayPause: () => {},
  nextTrack: () => {},
  prevTrack: () => {},
  seekTo: () => {},
  dismissPlayer: () => {},
});

export const useAudioPlayer = () => useContext(AudioPlayerContext);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<DownloadRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<DownloadRecord[]>([]);

  // Keep refs for current state inside event listeners
  const currentTrackRef = useRef<DownloadRecord | null>(null);
  currentTrackRef.current = currentTrack;

  const queueRef = useRef<DownloadRecord[]>([]);
  queueRef.current = queue;

  // Initialize expo-video player at the app root level
  // This instance stays alive across screen navigations and in the background
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
  });

  // Request Android 13+ POST_NOTIFICATIONS permission for background media notification
  useEffect(() => {
    async function requestNotificationPermission() {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        } catch (err) {
          console.warn('Could not request notification permission:', err);
        }
      }
    }
    requestNotificationPermission();
  }, []);

  // Configure player properties whenever player is available
  useEffect(() => {
    if (!player) return;
    try {
      player.loop = false;
      player.staysActiveInBackground = true;
      player.showNowPlayingNotification = true;
    } catch (e) {
      console.warn('Error setting player background properties:', e);
    }
  }, [player]);

  const playTrack = useCallback(
    (track: DownloadRecord, newQueue?: DownloadRecord[]) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      setCurrentTrack(track);
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      }

      if (player) {
        try {
          player.staysActiveInBackground = true;
          player.showNowPlayingNotification = true;

          // Pass full metadata so Android MediaSession and lockscreen show the title & art
          player.replace({
            uri: track.file_path,
            metadata: {
              title: track.title,
              artist: 'CLICKI Youtube',
              artwork: track.thumbnail_local_path || undefined,
            },
          });
          player.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn('Error playing track in AudioPlayerContext:', err);
        }
      }
    },
    [player]
  );

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player, isPlaying]);

  const nextTrack = useCallback(() => {
    const cur = currentTrackRef.current;
    const q = queueRef.current;
    if (!cur || q.length === 0) return;

    const currentIndex = q.findIndex((t) => t.id === cur.id);
    const nextIndex = (currentIndex + 1) % q.length;
    playTrack(q[nextIndex]);
  }, [playTrack]);

  const prevTrack = useCallback(() => {
    const cur = currentTrackRef.current;
    const q = queueRef.current;
    if (!cur || q.length === 0) return;

    if (playbackTime > 3 && player) {
      try {
        player.currentTime = 0;
      } catch {
        player.seekBy(-playbackTime);
      }
      return;
    }

    const currentIndex = q.findIndex((t) => t.id === cur.id);
    const prevIndex = (currentIndex - 1 + q.length) % q.length;
    playTrack(q[prevIndex]);
  }, [playbackTime, player, playTrack]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!player) return;
      try {
        player.currentTime = seconds;
        setPlaybackTime(seconds);
      } catch (err) {
        console.warn('Seek error:', err);
      }
    },
    [player]
  );

  const dismissPlayer = useCallback(() => {
    if (player) {
      try {
        player.pause();
      } catch {}
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    setPlaybackTime(0);
    setDuration(0);
  }, [player]);

  // Set up event listeners on the player
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') {
        setDuration(player.duration || 0);
      }
    });

    const playingSub = player.addListener('playingChange', (playing) => {
      setIsPlaying(playing.isPlaying);
    });

    const timeSub = player.addListener('timeUpdate', (event) => {
      setPlaybackTime(event.currentTime);
      if (player.duration) {
        setDuration(player.duration);
      }
      // Auto-advance to next track when track reaches end
      if (player.duration > 0 && event.currentTime >= player.duration - 0.5) {
        nextTrack();
      }
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
      timeSub.remove();
    };
  }, [player, nextTrack]);

  return (
    <AudioPlayerContext.Provider
      value={{
        player,
        currentTrack,
        isPlaying,
        playbackTime,
        duration,
        queue,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seekTo,
        dismissPlayer,
      }}
    >
      {/* Root invisible VideoView to attach player and sustain foreground service lifecycle */}
      {player && (
        <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} pointerEvents="none">
          <VideoView player={player} style={{ width: 1, height: 1 }} />
        </View>
      )}
      {children}
    </AudioPlayerContext.Provider>
  );
};
