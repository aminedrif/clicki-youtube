import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { downloadRepository } from '../database/downloadRepository';
import { DownloadRecord } from '../database/types';
import {
  ensureMediaDirectoryExists,
  sanitizeFilename,
  deleteLocalFile,
  downloadThumbnailLocally,
  saveToGalleryAsync,
} from '../services/fileService';
import { ResolveResult } from '../navigation/types';

export interface DownloadProgressState {
  isDownloading: boolean;
  progress: number; // 0 to 1
  bytesWritten: number;
  totalBytes: number;
  error: string | null;
  completedRecord: DownloadRecord | null;
  savedToGallery?: boolean;
  permissionDenied?: boolean;
  isAudio?: boolean;
}

export function useDownloadManager() {
  const [downloadState, setDownloadState] = useState<DownloadProgressState>({
    isDownloading: false,
    progress: 0,
    bytesWritten: 0,
    totalBytes: 0,
    error: null,
    completedRecord: null,
    savedToGallery: false,
    permissionDenied: false,
    isAudio: false,
  });

  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null);
  const targetFileUriRef = useRef<string | null>(null);

  const startDownload = useCallback(
    async (
      resolveData: ResolveResult,
      selectedQuality: string,
      selectedFormat: string,
      downloadMediaUrl: string
    ): Promise<DownloadRecord | null> => {
      setDownloadState({
        isDownloading: true,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        error: null,
        completedRecord: null,
        savedToGallery: false,
        isAudio: false,
      });

      // Web Browser Download Strategy
      if (Platform.OS === 'web') {
        try {
          const ext = selectedFormat === 'mp3' ? '.mp3' : '.mp4';
          const rawFilename = resolveData.filename || `clicki_${Date.now()}${ext}`;
          const baseName = sanitizeFilename(rawFilename.replace(/\.[^/.]+$/, ''));
          const finalFilename = `${baseName}_${Date.now()}${ext}`;

          let downloadUrl = downloadMediaUrl;
          let actualSize = 0;

          setDownloadState((prev) => ({
            ...prev,
            progress: 0.3,
            isDownloading: true,
          }));

          // Attempt local blob creation via dev proxy or direct fetch
          try {
            const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(downloadMediaUrl)}&filename=${encodeURIComponent(finalFilename)}`;
            let response = await fetch(proxyUrl).catch(() => null);
            
            // If proxy route not active, attempt direct fetch
            if (!response || !response.ok || response.headers.get('content-type')?.includes('text/html')) {
              response = await fetch(downloadMediaUrl).catch(() => null);
            }

            if (response && response.ok && !response.headers.get('content-type')?.includes('text/html')) {
              const blob = await response.blob();
              actualSize = blob.size;
              downloadUrl = URL.createObjectURL(blob);
              setDownloadState((prev) => ({
                ...prev,
                progress: 0.9,
                bytesWritten: actualSize,
                totalBytes: actualSize,
              }));
            }
          } catch (fetchErr) {
            console.log('Using direct stream URL on web:', fetchErr);
          }

          // Store record in SQLite database
          const savedRecord = await downloadRepository.insert({
            title: resolveData.title || finalFilename,
            thumbnail_local_path: resolveData.thumbnail || null,
            platform: resolveData.platform,
            original_url: resolveData.originalUrl,
            file_path: downloadUrl,
            format: selectedFormat,
            quality: selectedQuality,
            file_size: actualSize,
            downloaded_at: Date.now(),
          });

          setDownloadState({
            isDownloading: false,
            progress: 1,
            bytesWritten: actualSize,
            totalBytes: actualSize,
            error: null,
            completedRecord: savedRecord,
            savedToGallery: false,
            isAudio: false,
          });

          return savedRecord;
        } catch (webErr: any) {
          const message = webErr.message || 'Web download encountered an error.';
          setDownloadState((prev) => ({
            ...prev,
            isDownloading: false,
            error: message,
          }));
          return null;
        }
      }

      try {
        const dirUri = await ensureMediaDirectoryExists();
        const ext = selectedFormat === 'mp3' ? '.mp3' : '.mp4';
        // Safe ASCII filename to ensure 100% compatibility with native camera roll and file system
        const safeLocalFilename = `clicki_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
        const targetUri = `${dirUri}${safeLocalFilename}`;
        targetFileUriRef.current = targetUri;

        const downloadResumable = FileSystem.createDownloadResumable(
          downloadMediaUrl,
          targetUri,
          {},
          (progressEvent) => {
            const total = progressEvent.totalBytesExpectedToWrite;
            const written = progressEvent.totalBytesWritten;
            const currentProgress = total > 0 ? written / total : 0;

            setDownloadState((prev) => ({
              ...prev,
              progress: currentProgress,
              bytesWritten: written,
              totalBytes: total,
            }));
          }
        );

        downloadTaskRef.current = downloadResumable;

        const downloadResult = await downloadResumable.downloadAsync();

        if (!downloadResult || !downloadResult.uri) {
          throw new Error('Download failed or was aborted.');
        }

        // Get actual file size
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        const actualSize = fileInfo.exists ? (fileInfo.size || 0) : 0;

        // Verify that server did not return an HTML error page (e.g. 403 or 404)
        if (actualSize < 5000) {
          const sample = await FileSystem.readAsStringAsync(downloadResult.uri, {
            length: 500,
          }).catch(() => '');
          if (sample.includes('<html') || sample.includes('<!DOCTYPE') || sample.includes('{"error"')) {
            await deleteLocalFile(downloadResult.uri);
            throw new Error('Source server returned an error page instead of media content. Please try another link or quality.');
          }
        }

        // Automatically save video directly to device Photos app (Camera Roll)
        let savedToGallery = false;
        let permissionDenied = false;
        if (selectedFormat !== 'mp3') {
          try {
            const galleryResult = await saveToGalleryAsync(downloadResult.uri);
            savedToGallery = galleryResult.success;
            permissionDenied = Boolean(galleryResult.permissionDenied);
          } catch (mediaErr) {
            console.warn('Could not auto-save to camera roll:', mediaErr);
          }
        }

        // Cache thumbnail locally for offline viewing in history
        const localThumbPath = await downloadThumbnailLocally(
          resolveData.thumbnail,
          safeLocalFilename
        );

        // Store record in local SQLite database
        const savedRecord = await downloadRepository.insert({
          title: resolveData.title || safeLocalFilename,
          thumbnail_local_path: localThumbPath,
          platform: resolveData.platform,
          original_url: resolveData.originalUrl,
          file_path: downloadResult.uri,
          format: selectedFormat,
          quality: selectedQuality,
          file_size: actualSize,
          downloaded_at: Date.now(),
        });

        setDownloadState({
          isDownloading: false,
          progress: 1,
          bytesWritten: actualSize,
          totalBytes: actualSize,
          error: null,
          completedRecord: savedRecord,
          savedToGallery,
          permissionDenied,
          isAudio: false,
        });

        return savedRecord;
      } catch (err: any) {
        console.warn('startDownload error:', err);
        // Cleanup partial file on error or abort
        if (targetFileUriRef.current) {
          await deleteLocalFile(targetFileUriRef.current);
        }

        const message = err.message || 'An error occurred during download';
        setDownloadState((prev) => ({
          ...prev,
          isDownloading: false,
          error: message,
        }));
        return null;
      } finally {
        downloadTaskRef.current = null;
        targetFileUriRef.current = null;
      }
    },
    []
  );

  const cancelDownload = useCallback(async () => {
    if (downloadTaskRef.current) {
      try {
        await downloadTaskRef.current.pauseAsync();
      } catch {
        // Ignored
      }
      if (targetFileUriRef.current) {
        await deleteLocalFile(targetFileUriRef.current);
      }
      downloadTaskRef.current = null;
      targetFileUriRef.current = null;
      setDownloadState({
        isDownloading: false,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        error: 'Download cancelled by user.',
        completedRecord: null,
      });
    }
  }, []);

  return {
    downloadState,
    startDownload,
    cancelDownload,
  };
}
