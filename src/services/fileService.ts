import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const DOWNLOAD_SUBDIR = 'black_hole_media';

export async function ensureMediaDirectoryExists(): Promise<string> {
  if (Platform.OS === 'web') {
    return 'web-storage/';
  }

  const baseDir = FileSystem.documentDirectory || '';
  const dirUri = `${baseDir}${DOWNLOAD_SUBDIR}/`;
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
  return dirUri;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

export async function deleteLocalFile(fileUri: string | null | undefined): Promise<boolean> {
  if (!fileUri) return false;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && fileUri.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(fileUri);
      } catch {
        // Ignore revocation errors
      }
    }
    return true;
  }

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      return true;
    }
  } catch (error) {
    console.warn(`Failed to delete file at ${fileUri}:`, error);
  }
  return false;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function downloadThumbnailLocally(
  thumbnailRemoteUrl: string | undefined,
  baseFilename: string
): Promise<string | null> {
  if (!thumbnailRemoteUrl) return null;

  if (Platform.OS === 'web') {
    return thumbnailRemoteUrl;
  }

  try {
    const dirUri = await ensureMediaDirectoryExists();
    const cleanThumbName = `thumb_${sanitizeFilename(baseFilename)}.jpg`;
    const targetThumbUri = `${dirUri}${cleanThumbName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      thumbnailRemoteUrl,
      targetThumbUri
    );

    const result = await downloadResumable.downloadAsync();
    return result?.uri || null;
  } catch (error) {
    console.warn('Failed to cache thumbnail locally:', error);
    return thumbnailRemoteUrl;
  }
}

/**
 * Triggers direct browser download on web environments without relying on native video player 3-dots menus.
 */
export function triggerBrowserFileDownload(url: string, filename: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const cleanName = sanitizeFilename(filename);

    // 1. If it's a blob URL, anchor download works directly
    if (url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 1500);
      return;
    }

    // 2. For external media CDN URLs:
    // URLs with Content-Disposition: attachment trigger native browser download directly
    // via window.location.href without being blocked by popup blockers or navigating away.
    window.location.href = url;
  } catch (err) {
    console.warn('triggerBrowserFileDownload encountered an error:', err);
    try {
      window.open(url, '_blank');
    } catch {}
  }
}

export interface SaveGalleryResult {
  success: boolean;
  permissionDenied?: boolean;
  isAudio?: boolean;
  error?: string;
}

/**
 * Automatically saves a downloaded video/image file directly to the device's Photos / Camera Roll
 * on iOS (iPhone) and Android, with zero share dialogs needed.
 */
export async function saveToGalleryAsync(
  localUri: string
): Promise<SaveGalleryResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Web platform uses browser downloads' };
  }
  if (!localUri) {
    return { success: false, error: 'File URI is required' };
  }

  // 1. Verify media type: Photos Camera Roll strictly accepts video containers (MP4, MOV) and images
  const cleanUri = localUri.toLowerCase();
  const isVideo = cleanUri.endsWith('.mp4') || cleanUri.endsWith('.mov') || cleanUri.endsWith('.m4v');
  const isImage = cleanUri.endsWith('.jpg') || cleanUri.endsWith('.jpeg') || cleanUri.endsWith('.png');

  if (!isVideo && !isImage) {
    // Audio files (e.g. MP3, M4A) cannot be saved to the Photos library on iOS/Android
    return { success: false, isAudio: true, error: 'Audio files cannot be stored in the Photos Camera Roll' };
  }

  try {
    const LegacyMediaLibrary = require('expo-media-library/legacy');

    // 2. Check and request permissions
    let perm = await LegacyMediaLibrary.getPermissionsAsync();
    if (!perm.granted && perm.status !== 'granted') {
      perm = await LegacyMediaLibrary.requestPermissionsAsync();
    }

    if (
      perm.status === 'denied' ||
      (!perm.granted && perm.status !== 'granted' && perm.accessPrivileges === 'none')
    ) {
      return {
        success: false,
        permissionDenied: true,
        error: 'Photos permission is denied for Expo Go in iPhone Settings',
      };
    }

    // 3. Primary strategy: saveToLibraryAsync
    // On iOS, this delegates to Apple's UISaveVideoAtPathToSavedPhotosAlbum,
    // which operates cleanly with Add-Only permissions and does not trigger PHPhotosErrorDomain 3302.
    if (LegacyMediaLibrary.saveToLibraryAsync) {
      try {
        await LegacyMediaLibrary.saveToLibraryAsync(localUri);
        return { success: true };
      } catch (saveErr: any) {
        console.warn('saveToLibraryAsync attempt failed, trying fallback:', saveErr?.message);
        const errMsg = String(saveErr?.message || '').toLowerCase();
        if (errMsg.includes('permission') || errMsg.includes('access') || errMsg.includes('denied')) {
          return { success: false, permissionDenied: true, error: saveErr.message };
        }
      }
    }

    // 4. Secondary strategy: createAssetAsync (Standard Android MediaStore insertion)
    if (LegacyMediaLibrary.createAssetAsync) {
      try {
        await LegacyMediaLibrary.createAssetAsync(localUri);
        return { success: true };
      } catch (createErr: any) {
        console.warn('createAssetAsync attempt failed, trying fallback:', createErr?.message);
        const errMsg = String(createErr?.message || '').toLowerCase();
        if (errMsg.includes('permission') || errMsg.includes('access') || errMsg.includes('denied')) {
          return { success: false, permissionDenied: true, error: createErr.message };
        }
      }
    }

    // 5. Tertiary strategy: Expo SDK 57 class-based Asset.create
    try {
      const MediaLibrary = require('expo-media-library');
      if (MediaLibrary.Asset?.create) {
        await MediaLibrary.Asset.create(localUri);
        return { success: true };
      }
    } catch (newAssetErr: any) {
      console.warn('Asset.create attempt failed:', newAssetErr?.message);
    }

    return {
      success: false,
      error: 'Video codec or container is not directly accepted by iOS Camera Roll',
    };
  } catch (err: any) {
    console.warn('saveToGalleryAsync encountered an error:', err);
    return { success: false, error: err?.message || 'Permission or storage error' };
  }
}

/**
 * Universal Share / Save to Files fallback via iOS/Android system sheet
 */
export async function shareFileAsync(localUri: string, isAudio: boolean = false): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const Sharing = require('expo-sharing');
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) return false;

    await Sharing.shareAsync(localUri, {
      UTI: isAudio ? 'public.audio' : 'public.movie',
      mimeType: isAudio ? 'audio/mpeg' : 'video/mp4',
      dialogTitle: 'Save or Share Media',
    });
    return true;
  } catch (err) {
    console.warn('shareFileAsync encountered an error:', err);
    return false;
  }
}


