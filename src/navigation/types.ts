import { DownloadRecord, SupportedPlatform } from '../database/types';

export interface ResolveMediaItem {
  id?: string;
  type: 'video' | 'photo' | 'audio';
  url: string;
  thumb?: string;
  title?: string;
}

export interface ResolveResult {
  status: 'tunnel' | 'redirect' | 'picker' | 'error';
  url?: string;
  filename?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  platform: SupportedPlatform;
  originalUrl: string;
  picker?: ResolveMediaItem[];
  availableQualities?: string[];
  audioOnlyAvailable?: boolean;
}

export type RootStackParamList = {
  Home: undefined;
  Preview: {
    resolveData: ResolveResult;
  };
  Download: {
    resolveData: ResolveResult;
    selectedQuality: string;
    selectedFormat: string;
    targetUrl: string;
  };
  History: undefined;
  Player: {
    downloadRecord: DownloadRecord;
  };
};
