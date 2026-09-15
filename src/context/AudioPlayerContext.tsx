import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, View } from 'react-native';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { DownloadRecord } from '../database/types';
import { FullAudioPlayerModal } from '../components/FullAudioPlayerModal';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioPlayerContextType {
  player: VideoPlayer | null;
  currentTrack: DownloadRecord | null;
  isPlaying: boolean;
  playbackTime: number;
  duration: number;
  queue: DownloadRecord[];
  playbackSpeed: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
  isFullPlayerVisible: boolean;
  playTrack: (track: DownloadRecord, newQueue?: DownloadRecord[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  setSleepTimer: (minutes: number | null) => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  dismissPlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  player: null,
  currentTrack: null,
  isPlaying: false,
  playbackTime: 0,
  duration: 0,
  queue: [],
  playbackSpeed: 1.0,
  repeatMode: 'off',
  isShuffle: false,
  sleepTimerMinutes: null,
  sleepTimerRemaining: null,
  isFullPlayerVisible: false,
  playTrack: () => {},
  togglePlayPause: () => {},
  nextTrack: () => {},
  prevTrack: () => {},
  seekTo: () => {},
  seekBy: () => {},
  setPlaybackSpeed: () => {},
  toggleRepeatMode: () => {},
  toggleShuffle: () => {},
  setSleepTimer: () => {},
  openFullPlayer: () => {},
  closeFullPlayer: () => {},
  dismissPlayer: () => {},
});

export const useAudioPlayer = () => useContext(AudioPlayerContext);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<DownloadRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<DownloadRecord[]>([]);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [isFullPlayerVisible, setIsFullPlayerVisible] = useState(false);

  // Keep refs for current state inside event listeners
  const currentTrackRef = useRef<DownloadRecord | null>(null);
  currentTrackRef.current = currentTrack;

  const queueRef = useRef<DownloadRecord[]>([]);
  queueRef.current = queue;

  const repeatModeRef = useRef<RepeatMode>('off');
  repeatModeRef.current = repeatMode;

  const isShuffleRef = useRef<boolean>(false);
  isShuffleRef.current = isShuffle;

  const sleepTimerMinutesRef = useRef<number | null>(null);
  sleepTimerMinutesRef.current = sleepTimerMinutes;

  const playbackSpeedRef = useRef<number>(1.0);
  playbackSpeedRef.current = playbackSpeed;

  // Initialize expo-video player at the app root level
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
      player.loop = repeatMode === 'one';
      player.staysActiveInBackground = true;
      player.showNowPlayingNotification = true;
      try {
        player.playbackRate = playbackSpeed;
      } catch {}
    } catch (e) {
      console.warn('Error setting player background properties:', e);
    }
  }, [player, repeatMode, playbackSpeed]);

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
          player.loop = repeatModeRef.current === 'one';

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
          try {
            player.playbackRate = playbackSpeedRef.current;
          } catch {}
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

    if (isShuffleRef.current && q.length > 1) {
      const remaining = q.filter((t) => t.id !== cur.id);
      const randomIndex = Math.floor(Math.random() * remaining.length);
      playTrack(remaining[randomIndex]);
      return;
    }

    const currentIndex = q.findIndex((t) => t.id === cur.id);
    if (currentIndex === -1) {
      playTrack(q[0]);
      return;
    }

    if (currentIndex === q.length - 1) {
      if (repeatModeRef.current === 'off') {
        if (player) {
          try {
            player.pause();
          } catch {}
        }
        setIsPlaying(false);
        return;
      }
      // Loop back to start in 'all'
      playTrack(q[0]);
    } else {
      playTrack(q[currentIndex + 1]);
    }
  }, [playTrack, player]);

  const prevTrack = useCallback(() => {
    const cur = currentTrackRef.current;
    const q = queueRef.current;
    if (!cur || q.length === 0) return;

    if (playbackTime > 3 && player) {
      try {
        player.currentTime = 0;
        setPlaybackTime(0);
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

  const seekBy = useCallback(
    (seconds: number) => {
      if (!player) return;
      try {
        const cur = player.currentTime || playbackTime;
        const dur = player.duration || duration;
        const target = Math.max(0, Math.min(dur || 999999, cur + seconds));
        player.currentTime = target;
        setPlaybackTime(target);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      } catch (err) {
        console.warn('SeekBy error:', err);
      }
    },
    [player, playbackTime, duration]
  );

  const setPlaybackSpeed = useCallback(
    (speed: number) => {
      setPlaybackSpeedState(speed);
      if (player) {
        try {
          player.playbackRate = speed;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
          console.warn('Could not set playbackRate:', e);
        }
      }
    },
    [player]
  );

  const toggleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      let next: RepeatMode = 'off';
      if (prev === 'off') next = 'all';
      else if (prev === 'all') next = 'one';
      else next = 'off';

      if (player) {
        player.loop = next === 'one';
      }
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      return next;
    });
  }, [player]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      return !prev;
    });
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      setSleepTimerMinutes(minutes);
      if (minutes === null) {
        setSleepTimerRemaining(null);
      } else if (minutes === -1) {
        // End of current track
        const remaining = Math.max(0, Math.round(duration - playbackTime));
        setSleepTimerRemaining(remaining);
      } else {
        setSleepTimerRemaining(minutes * 60);
      }
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
    [duration, playbackTime]
  );

  // Sleep timer countdown ticker
  useEffect(() => {
    if (sleepTimerRemaining === null) return;

    if (sleepTimerRemaining <= 0) {
      if (player) {
        try {
          player.pause();
        } catch {}
      }
      setIsPlaying(false);
      setSleepTimerMinutes(null);
      setSleepTimerRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining, player]);

  const openFullPlayer = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsFullPlayerVisible(true);
  }, []);

  const closeFullPlayer = useCallback(() => {
    setIsFullPlayerVisible(false);
  }, []);

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
    setIsFullPlayerVisible(false);
  }, [player]);

  // Set up event listeners on the player
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') {
        setDuration(player.duration || 0);
        try {
          player.playbackRate = playbackSpeedRef.current;
        } catch {}
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

      // Auto-advance or stop at end of track
      if (player.duration > 0 && event.currentTime >= player.duration - 0.5) {
        if (sleepTimerMinutesRef.current === -1) {
          player.pause();
          setIsPlaying(false);
          setSleepTimerMinutes(null);
          setSleepTimerRemaining(null);
          return;
        }

        if (repeatModeRef.current === 'one') {
          try {
            player.currentTime = 0;
            player.play();
          } catch {}
          return;
        }

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
        playbackSpeed,
        repeatMode,
        isShuffle,
        sleepTimerMinutes,
        sleepTimerRemaining,
        isFullPlayerVisible,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seekTo,
        seekBy,
        setPlaybackSpeed,
        toggleRepeatMode,
        toggleShuffle,
        setSleepTimer,
        openFullPlayer,
        closeFullPlayer,
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
      <FullAudioPlayerModal />
    </AudioPlayerContext.Provider>
  );
};
