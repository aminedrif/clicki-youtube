import { useState, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { extractUrl, detectPlatform, PlatformInfo } from '../services/platformDetector';

export interface ClipboardCheckResult {
  hasValidUrl: boolean;
  url: string | null;
  platformInfo: PlatformInfo | null;
  message: string | null;
}

export function useClipboardDetector() {
  const [lastDetectedUrl, setLastDetectedUrl] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);

  const checkClipboard = useCallback(async (): Promise<ClipboardCheckResult> => {
    setIsReading(true);
    try {
      // Provide immediate subtle tactile feedback on touch
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics unavailable on web/unsupported device
      }

      const clipboardContent = await Clipboard.getStringAsync();
      const extracted = extractUrl(clipboardContent);

      if (!extracted) {
        const msg = !clipboardContent || clipboardContent.trim() === ''
          ? 'Clipboard is empty. Copy a link first.'
          : 'No valid link in clipboard.';
        setFeedbackMessage(msg);
        return {
          hasValidUrl: false,
          url: null,
          platformInfo: null,
          message: msg,
        };
      }

      const platformInfo = detectPlatform(extracted);

      if (!platformInfo.isValid) {
        const msg = 'Unsupported platform. Supported: TikTok, IG, YT, X, FB, Pinterest, Reddit, Snapchat.';
        setFeedbackMessage(msg);
        return {
          hasValidUrl: false,
          url: extracted,
          platformInfo,
          message: msg,
        };
      }

      // Valid social media link detected!
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Haptics fallback
      }

      setLastDetectedUrl(extracted);
      setFeedbackMessage(null);

      return {
        hasValidUrl: true,
        url: extracted,
        platformInfo,
        message: null,
      };
    } catch (error: any) {
      const msg = 'Failed to read clipboard';
      setFeedbackMessage(msg);
      return {
        hasValidUrl: false,
        url: null,
        platformInfo: null,
        message: msg,
      };
    } finally {
      setIsReading(false);
    }
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedbackMessage(null);
  }, []);

  return {
    checkClipboard,
    lastDetectedUrl,
    feedbackMessage,
    isReading,
    clearFeedback,
  };
}
