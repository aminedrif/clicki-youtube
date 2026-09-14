import { getDatabase } from './db';
import { DownloadRecord, NewDownloadRecord } from './types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const downloadRepository = {
  async insert(record: NewDownloadRecord): Promise<DownloadRecord> {
    const db = await getDatabase();
    const id = record.id || generateId();
    const newRecord: DownloadRecord = {
      ...record,
      id,
    };

    await db.runAsync(
      `INSERT INTO downloads (
        id, title, thumbnail_local_path, platform, original_url, file_path, format, quality, file_size, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newRecord.id,
        newRecord.title,
        newRecord.thumbnail_local_path,
        newRecord.platform,
        newRecord.original_url,
        newRecord.file_path,
        newRecord.format,
        newRecord.quality,
        newRecord.file_size,
        newRecord.downloaded_at,
      ]
    );

    return newRecord;
  },

  async getAll(): Promise<DownloadRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DownloadRecord>(
      'SELECT * FROM downloads ORDER BY downloaded_at DESC'
    );
    return rows;
  },

  async getById(id: string): Promise<DownloadRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DownloadRecord>(
      'SELECT * FROM downloads WHERE id = ?',
      [id]
    );
    return row || null;
  },

  async findByUrl(url: string): Promise<DownloadRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DownloadRecord>(
      'SELECT * FROM downloads WHERE original_url = ? ORDER BY downloaded_at DESC LIMIT 1',
      [url]
    );
    return row || null;
  },

  async deleteById(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
    return result.changes > 0;
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM downloads');
  },
};
