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

  async searchTracks(query?: string, format?: string): Promise<DownloadRecord[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM downloads WHERE 1=1';
    const params: any[] = [];

    if (format) {
      sql += ' AND (format = ? OR file_path LIKE ?)';
      params.push(format, `%.${format}`);
    }

    if (query && query.trim()) {
      sql += ' AND (title LIKE ? OR original_url LIKE ?)';
      const term = `%${query.trim()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY downloaded_at DESC';
    return await db.getAllAsync<DownloadRecord>(sql, params);
  },

  async getVideosOnly(): Promise<DownloadRecord[]> {
    const db = await getDatabase();
    return await db.getAllAsync<DownloadRecord>(
      "SELECT * FROM downloads WHERE format = 'mp4' OR file_path LIKE '%.mp4' ORDER BY downloaded_at DESC"
    );
  },

  async getMp3sOnly(): Promise<DownloadRecord[]> {
    const db = await getDatabase();
    return await db.getAllAsync<DownloadRecord>(
      "SELECT * FROM downloads WHERE format = 'mp3' OR file_path LIKE '%.mp3' ORDER BY downloaded_at DESC"
    );
  },

  async getPlaylist(format: string = 'mp3'): Promise<DownloadRecord[]> {
    return this.searchTracks('', format);
  },

  // --- Playlist Management (Spotify Style) ---
  async createPlaylist(name: string): Promise<{ id: string; name: string; created_at: number; cover_url: string | null; track_count: number }> {
    const db = await getDatabase();
    const id = generateId();
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO playlists (id, name, created_at, cover_url) VALUES (?, ?, ?, ?)',
      [id, name.trim(), now, null]
    );
    return { id, name: name.trim(), created_at: now, cover_url: null, track_count: 0 };
  },

  async getAllPlaylists(): Promise<Array<{ id: string; name: string; created_at: number; cover_url: string | null; track_count: number }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      created_at: number;
      cover_url: string | null;
      track_count: number;
    }>(`
      SELECT 
        p.id, 
        p.name, 
        p.created_at, 
        p.cover_url,
        (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) AS track_count
      FROM playlists p
      ORDER BY p.created_at DESC
    `);
    return rows;
  },

  async deletePlaylist(playlistId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM playlist_items WHERE playlist_id = ?', [playlistId]);
    await db.runAsync('DELETE FROM playlists WHERE id = ?', [playlistId]);
  },

  async addTrackToPlaylist(playlistId: string, downloadId: string): Promise<void> {
    const db = await getDatabase();
    const id = generateId();
    await db.runAsync(
      'INSERT OR IGNORE INTO playlist_items (id, playlist_id, download_id, added_at) VALUES (?, ?, ?, ?)',
      [id, playlistId, downloadId, Date.now()]
    );
  },

  async removeTrackFromPlaylist(playlistId: string, downloadId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM playlist_items WHERE playlist_id = ? AND download_id = ?',
      [playlistId, downloadId]
    );
  },

  async getPlaylistTracks(playlistId: string): Promise<DownloadRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DownloadRecord>(`
      SELECT d.* 
      FROM downloads d
      INNER JOIN playlist_items pi ON d.id = pi.download_id
      WHERE pi.playlist_id = ?
      ORDER BY pi.added_at DESC
    `, [playlistId]);
    return rows;
  },

  async getTrackPlaylistIds(downloadId: string): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ playlist_id: string }>(
      'SELECT playlist_id FROM playlist_items WHERE download_id = ?',
      [downloadId]
    );
    return rows.map((r) => r.playlist_id);
  },

  async deleteMultiple(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM playlist_items WHERE download_id IN (${placeholders})`, ids);
    await db.runAsync(`DELETE FROM downloads WHERE id IN (${placeholders})`, ids);
  },

  async addMultipleTracksToPlaylist(playlistId: string, downloadIds: string[]): Promise<void> {
    if (!downloadIds || downloadIds.length === 0) return;
    const db = await getDatabase();
    const now = Date.now();
    for (const dId of downloadIds) {
      const id = generateId();
      await db.runAsync(
        'INSERT OR IGNORE INTO playlist_items (id, playlist_id, download_id, added_at) VALUES (?, ?, ?, ?)',
        [id, playlistId, dId, now]
      );
    }
  },

  async renamePlaylist(playlistId: string, newName: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE playlists SET name = ? WHERE id = ?', [newName.trim(), playlistId]);
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM playlist_items');
    await db.runAsync('DELETE FROM playlists');
    await db.runAsync('DELETE FROM downloads');
  },
};
