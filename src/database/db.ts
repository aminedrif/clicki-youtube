import * as SQLite from 'expo-sqlite';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const db = await SQLite.openDatabaseAsync('blackhole.db');
  
  // Enable WAL mode for optimal concurrent reads/writes
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      thumbnail_local_path TEXT,
      platform TEXT NOT NULL,
      original_url TEXT NOT NULL,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      quality TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      downloaded_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_downloads_url ON downloads(original_url);
    CREATE INDEX IF NOT EXISTS idx_downloads_format ON downloads(format);

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cover_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_playlists_created_at ON playlists(created_at DESC);

    CREATE TABLE IF NOT EXISTS playlist_items (
      id TEXT PRIMARY KEY NOT NULL,
      playlist_id TEXT NOT NULL,
      download_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      UNIQUE(playlist_id, download_id)
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_download ON playlist_items(download_id);
  `);

  databaseInstance = db;
  return databaseInstance;
}
