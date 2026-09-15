import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlackHoleVisual } from './BlackHoleVisual';
import { colors } from '../theme/colors';

interface AppInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ visible, onClose }) => {
  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BlackHoleVisual size={28} showLabel={false} disabled />
              <View>
                <Text style={styles.brandTitle}>CLICKI YOUTUBE</Text>
                <Text style={styles.versionText}>Version 1.0.0 • Build 2026</Text>
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
            {/* Developer Card */}
            <View style={styles.developerCard}>
              <View style={styles.devAvatar}>
                <Ionicons name="person" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.devInfo}>
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>CREATOR & DEVELOPER</Text>
                </View>
                <Text style={styles.devName}>Amine Drif</Text>
                <Text style={styles.devRole}>Lead Software Engineer & Designer</Text>
              </View>
            </View>

            {/* About App Description */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
                <Text style={styles.sectionTitle}>ABOUT CLICKI</Text>
              </View>
              <Text style={styles.aboutText}>
                CLICKI is a next-generation offline media player and downloader designed for high-performance audio and video playback, Spotify-style playlist management, background playback, and complete privacy.
              </Text>
            </View>

            {/* App Specs Grid */}
            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                <Text style={styles.specLabel}>Privacy</Text>
                <Text style={styles.specValue}>100% Offline</Text>
              </View>

              <View style={styles.specItem}>
                <Ionicons name="speedometer-outline" size={18} color="#3B82F6" />
                <Text style={styles.specLabel}>Audio Engine</Text>
                <Text style={styles.specValue}>320kbps HD</Text>
              </View>

              <View style={styles.specItem}>
                <Ionicons name="sync-outline" size={18} color="#F59E0B" />
                <Text style={styles.specLabel}>Updates</Text>
                <Text style={styles.specValue}>Auto OTA</Text>
              </View>
            </View>

            {/* Official Channels / Links */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeader}>
                <Ionicons name="globe-outline" size={16} color={colors.accent} />
                <Text style={styles.sectionTitle}>OFFICIAL PORTAL</Text>
              </View>
              
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openLink('https://aminedrif.github.io/clicki-youtube/')}
                activeOpacity={0.7}
              >
                <Ionicons name="link-outline" size={18} color={colors.accent} />
                <Text style={styles.linkText}>aminedrif.github.io/clicki-youtube</Text>
                <Ionicons name="open-outline" size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Confirmation Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxHeight: '84%',
    backgroundColor: '#0E0E12',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: 22,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
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
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  versionText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
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
    gap: 14,
    paddingVertical: 4,
  },
  developerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  devAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  devInfo: {
    flex: 1,
  },
  devBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  devBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  devName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  devRole: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  sectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  aboutText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
  },
  specsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  specItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  specLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  specValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  linkText: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
