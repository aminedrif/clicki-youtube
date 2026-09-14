import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { RootStackParamList } from '../navigation/types';
import { BlackHoleVisual, BlackHoleStatus } from '../components/BlackHoleVisual';
import { useClipboardDetector } from '../hooks/useClipboardDetector';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { resolveCobaltMedia } from '../api/cobaltClient';
import { colors } from '../theme/colors';

// Injected WebKit script to extract video/photo stream from real mobile browser DOM / JSON
const INJECTED_EXTRACTOR_JS = `
(function() {
  var sent = false;
  function report(mediaUrl, thumbUrl, pageTitle) {
    if (sent || !mediaUrl) return;
    sent = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MEDIA_EXTRACTED',
      url: mediaUrl,
      thumbnail: thumbUrl || '',
      title: pageTitle || document.title || 'Social Media'
    }));
  }

  function scan() {
    // 1. Scan <video> elements in DOM
    var vids = document.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      var src = v.currentSrc || v.src;
      if (src && src.indexOf('http') === 0 && src.indexOf('blob:') !== 0) {
        report(src, v.poster);
        return true;
      }
    }

    // 2. Scan shreddit-player or custom elements (Reddit)
    var shred = document.querySelector('shreddit-player, shreddit-player-2');
    if (shred) {
      var sSrc = shred.getAttribute('src') || shred.getAttribute('stream-url');
      if (sSrc && sSrc.indexOf('http') === 0) {
        report(sSrc, shred.getAttribute('preview'));
        return true;
      }
    }

    // 3. Scan script tags for video_url, packaged media, or pinimg
    var scripts = document.querySelectorAll('script');
    for (var j = 0; j < scripts.length; j++) {
      var content = scripts[j].textContent || '';
      var m = content.match(/"video_url":"([^"]+)"/);
      if (m && m[1]) {
        var cleanUrl = m[1].replace(/\\u0026/g, '&').replace(/\\u002F/g, '/');
        report(cleanUrl);
        return true;
      }
      var mp4Match = content.match(/https?:[^"'\s<>]+\.mp4[^"'\s<>]*/i);
      if (mp4Match) {
        var cleanMp4 = mp4Match[0].replace(/\\u0026/g, '&').replace(/\\u002F/g, '/');
        report(cleanMp4);
        return true;
      }
    }

    // 4. OpenGraph video meta tags
    var ogV = document.querySelector('meta[property="og:video"], meta[property="og:video:secure_url"]');
    if (ogV && ogV.content && ogV.content.indexOf('http') === 0) {
      report(ogV.content);
      return true;
    }

    // 5. OpenGraph or image tags for Pinterest or Reddit photos
    var ogI = document.querySelector('meta[property="og:image"]');
    if (ogI && ogI.content && (ogI.content.indexOf('pinimg.com') !== -1 || ogI.content.indexOf('redd.it') !== -1)) {
      report(ogI.content);
      return true;
    }

    return false;
  }

  scan();
  var poller = setInterval(function() {
    if (scan()) clearInterval(poller);
  }, 250);
  setTimeout(function() { clearInterval(poller); }, 9000);
})();
true;
`;

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { checkClipboard, feedbackMessage, clearFeedback } = useClipboardDetector();
  const { startDownload, cancelDownload } = useDownloadManager();

  const [holeStatus, setHoleStatus] = useState<BlackHoleStatus>('idle');
  const [isSucking, setIsSucking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAttemptedUrl, setLastAttemptedUrl] = useState<string | null>(null);

  // Manual input modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Hidden In-App WebKit extractor state
  const [headlessUrl, setHeadlessUrl] = useState<string | null>(null);
  const headlessResolverRef = useRef<((media: { url: string; title?: string; thumbnail?: string } | null) => void) | null>(null);
  const headlessTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const extractWithHeadlessWebView = (rawUrl: string): Promise<{ url: string; title?: string; thumbnail?: string } | null> => {
    return new Promise((resolve) => {
      if (headlessTimeoutRef.current) clearTimeout(headlessTimeoutRef.current);

      let target = rawUrl;
      const scMatch = rawUrl.match(/instagram\.com\/(?:p|reel|tv|stories\/[^/]+)\/([A-Za-z0-9_-]+)/i);
      if (scMatch) {
        // Load the public captioned embed page which contains the HTML5 video player without login walls
        target = `https://www.instagram.com/p/${scMatch[1]}/embed/captioned/`;
      }

      headlessResolverRef.current = resolve;
      setHeadlessUrl(target);

      // Max 10s timeout
      headlessTimeoutRef.current = setTimeout(() => {
        setHeadlessUrl(null);
        if (headlessResolverRef.current) {
          headlessResolverRef.current(null);
          headlessResolverRef.current = null;
        }
      }, 10000);
    });
  };

  const handleHeadlessMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MEDIA_EXTRACTED' && data.url) {
        if (headlessTimeoutRef.current) clearTimeout(headlessTimeoutRef.current);
        setHeadlessUrl(null);
        if (headlessResolverRef.current) {
          headlessResolverRef.current({
            url: data.url,
            title: data.title,
            thumbnail: data.thumbnail,
          });
          headlessResolverRef.current = null;
        }
      }
    } catch {}
  };

  const handleHolePress = async () => {
    if (holeStatus === 'resolving' || holeStatus === 'downloading') return;
    setErrorMessage(null);
    clearFeedback();

    const result = await checkClipboard();

    if (result.hasValidUrl && result.url) {
      processUrl(result.url);
    }
  };

  const processUrl = async (url: string) => {
    setLastAttemptedUrl(url);
    setHoleStatus('resolving');
    setErrorMessage(null);
    setIsSucking(true);
    setTimeout(() => setIsSucking(false), 900);

    try {
      let resolveData: any = null;

      // 1. First attempt standard direct network resolver
      try {
        resolveData = await resolveCobaltMedia(url, { videoQuality: 'max' });
      } catch (directErr: any) {
        // 2. If direct network resolver failed, activate hidden In-App WebKit extractor (like official Black Hole)
        const isInstagram = url.toLowerCase().includes('instagram.com');
        const isReddit = url.toLowerCase().includes('reddit.com') || url.toLowerCase().includes('redd.it');
        const isPinterest = url.toLowerCase().includes('pinterest') || url.toLowerCase().includes('pin.it');
        if (isInstagram || isReddit || isPinterest) {
          const platformKey = isInstagram ? 'instagram' : isReddit ? 'reddit' : 'pinterest';
          console.log(`[Black Hole] Activating in-app WebKit extractor for ${platformKey}...`);
          const webResult = await extractWithHeadlessWebView(url);
          if (webResult && webResult.url) {
            const isVideo = webResult.url.includes('.mp4') || !webResult.url.match(/\.(jpe?g|png|webp)/i);
            resolveData = {
              status: 'redirect',
              url: webResult.url,
              filename: `${platformKey}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
              title: webResult.title || `${platformKey.charAt(0).toUpperCase() + platformKey.slice(1)} Media`,
              thumbnail: webResult.thumbnail,
              platform: platformKey,
              originalUrl: url,
              availableQualities: ['Original Quality'],
              audioOnlyAvailable: false,
            };
          }
        }

        if (!resolveData) {
          throw directErr;
        }
      }

      // 3. Select highest quality media URL directly
      const downloadMediaUrl =
        resolveData.url ||
        (resolveData.picker && resolveData.picker.length > 0
          ? resolveData.picker[0].url
          : null);

      if (!downloadMediaUrl) {
        throw new Error('No downloadable media stream found for this link.');
      }

      // 4. Immediately start download in background
      setHoleStatus('downloading');

      const savedRecord = await startDownload(
        resolveData,
        'highest',
        'mp4',
        downloadMediaUrl
      );

      if (savedRecord) {
        setHoleStatus('success');
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Reset back to idle after 3 seconds
        setTimeout(() => {
          setHoleStatus('idle');
        }, 3000);
      } else {
        setHoleStatus('error');
        setErrorMessage('Download was interrupted or cancelled.');
        setTimeout(() => {
          setHoleStatus('idle');
        }, 3500);
      }
    } catch (err: any) {
      setHoleStatus('error');
      setErrorMessage(err.message || 'Failed to download media.');
      setTimeout(() => {
        setHoleStatus('idle');
      }, 4000);
    }
  };

  const handleManualSubmit = () => {
    if (!manualUrl.trim()) return;
    setShowManualModal(false);
    const target = manualUrl.trim();
    setManualUrl('');
    processUrl(target);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Minimal Top Header Bar: History on left, Logo in center, Paste on right */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.historyButtonText}>HISTORIQUE</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>CLICKI</Text>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowManualModal(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="link-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main Void Canvas */}
      <View style={styles.centerStage}>
        <BlackHoleVisual
          onPress={handleHolePress}
          isSucking={isSucking}
          status={holeStatus}
        />

        {/* Dynamic Status / Feedback Area Below Hole */}
        <View style={styles.feedbackArea}>
          {holeStatus === 'resolving' ? (
            <Text style={styles.resolvingText}>EXPANDING MEDIA SINGULARITY</Text>
          ) : holeStatus === 'downloading' ? (
            <View style={styles.downloadingRow}>
              <Text style={styles.downloadingText}>DOWNLOADING TO CAMERA ROLL</Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  cancelDownload();
                  setHoleStatus('idle');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : holeStatus === 'success' ? (
            <Text style={styles.successText}>SAVED DIRECTLY TO YOUR PHOTOS</Text>
          ) : errorMessage ? (
            <View style={styles.errorContainer}>
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText} numberOfLines={3}>{errorMessage}</Text>
              </View>
            </View>
          ) : feedbackMessage ? (
            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.hintText}>{feedbackMessage}</Text>
            </View>
          ) : (
            <Text style={styles.instructionText}>TAP SINGULARITY TO INGEST CLIPBOARD</Text>
          )}
        </View>
      </View>

      {/* Bottom Platform Badges */}
      <View style={styles.bottomBar}>
        <Text style={styles.supportedText}>
          TIKTOK • INSTAGRAM • YOUTUBE • X • FACEBOOK • REDDIT • SNAPCHAT • PINTEREST
        </Text>
      </View>

      {/* Manual Link Input Modal */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Media URL</Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="https://www.tiktok.com/@..."
              placeholderTextColor={colors.textMuted}
              value={manualUrl}
              onChangeText={setManualUrl}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowManualModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleManualSubmit}
              >
                <Text style={styles.modalSubmitText}>Ingest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invisible Background Headless WebKit Extractor */}
      {headlessUrl && (
        <View style={styles.hiddenWebViewContainer} pointerEvents="none">
          <WebView
            source={{ uri: headlessUrl }}
            injectedJavaScript={INJECTED_EXTRACTOR_JS}
            onMessage={handleHeadlessMessage}
            onShouldStartLoadWithRequest={(request) => {
              const u = request.url;
              if (
                u &&
                (u.includes('.mp4') || u.includes('pinimg.com/originals') || u.includes('i.redd.it')) &&
                (u.includes('cdninstagram') ||
                  u.includes('fbcdn.net') ||
                  u.includes('instagram') ||
                  u.includes('redd.it') ||
                  u.includes('reddit') ||
                  u.includes('pinimg.com'))
              ) {
                if (headlessTimeoutRef.current) clearTimeout(headlessTimeoutRef.current);
                setHeadlessUrl(null);
                if (headlessResolverRef.current) {
                  headlessResolverRef.current({ url: u });
                  headlessResolverRef.current = null;
                }
                return false;
              }
              return true;
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyButtonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  iconButton: {
    padding: 6,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackArea: {
    marginTop: 40,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  instructionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
  resolvingText: {
    color: colors.glowViolet,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadingText: {
    color: colors.glowCyan,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  successText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A0E13',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    gap: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.2)',
    gap: 8,
  },
  hintText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  bottomBar: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  supportedText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#111218',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#08080C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    backgroundColor: colors.glowViolet,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hiddenWebViewContainer: {
    width: 1,
    height: 1,
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
});
