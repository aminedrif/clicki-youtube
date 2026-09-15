import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlackHoleVisual } from './BlackHoleVisual';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface AppInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top Visual & Close */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BlackHoleVisual size={28} showLabel={false} disabled />
              <View style={styles.brandTextCol}>
                <Text style={styles.brandTitle}>CLICKI YOUTUBE</Text>
                <Text style={styles.versionText}>v2.4.0 • Offline Media & Player</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Guide Item 1 */}
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="flash-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Instant Download</Text>
                <Text style={styles.featureDesc}>
                  Copy any YouTube link and tap the Black Hole to download 320kbps MP3 audio or 1080p MP4 video directly to your storage.
                </Text>
              </View>
            </View>

            {/* Guide Item 2 */}
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="headset-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Background Playback</Text>
                <Text style={styles.featureDesc}>
                  Music keeps playing seamlessly when you switch apps or lock your screen, with full Android 14 notification controls.
                </Text>
              </View>
            </View>

            {/* Guide Item 3 */}
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Advanced Player</Text>
                <Text style={styles.featureDesc}>
                  Tap the mini-player to open the full screen: change playback speed (0.5x to 2x), seek with the scrubber, jump ±10s, and set a sleep timer.
                </Text>
              </View>
            </View>

            {/* Guide Item 4 */}
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="albums-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Spotify-Style Playlists</Text>
                <Text style={styles.featureDesc}>
                  Organize your music into custom playlists. Use Multi-Select mode to batch add or delete songs effortlessly.
                </Text>
              </View>
            </View>

            {/* Guide Item 5 */}
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>100% Offline & Private</Text>
                <Text style={styles.featureDesc}>
                  All downloaded files stay locally on your device. Listen anywhere, anytime without an internet connection.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Confirmation Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>GOT IT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#111117',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: 22,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTextCol: {},
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  versionText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    marginVertical: 14,
  },
  scrollContent: {
    gap: 16,
    paddingVertical: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
