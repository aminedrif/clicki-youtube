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
  `);

  databaseInstance = db;
  return databaseInstance;
}
