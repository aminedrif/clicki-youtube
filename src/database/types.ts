export type SupportedPlatform =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'pinterest'
  | 'reddit'
  | 'snapchat'
  | 'unknown';

export interface DownloadRecord {
  id: string;
  title: string;
  thumbnail_local_path: string | null;
  platform: SupportedPlatform;
  original_url: string;
  file_path: string;
  format: string;
  quality: string;
  file_size: number; // in bytes
  downloaded_at: number; // Unix timestamp in ms
}

export type NewDownloadRecord = Omit<DownloadRecord, 'id'> & { id?: string };
