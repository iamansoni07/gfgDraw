import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

const dbPath = process.env.DATABASE_PATH || './data/gfgdraw.db';

if (dbPath !== ':memory:') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const db = new DatabaseSync(dbPath);

// Initialize schema
export function initDatabase(): void {
  // WAL mode for fast concurrency
  db.exec('PRAGMA journal_mode = WAL;');

  // Boards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      folder TEXT DEFAULT 'General',
      tags TEXT DEFAULT '[]',
      is_starred INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      node_count INTEGER DEFAULT 0,
      edge_count INTEGER DEFAULT 0
    );
  `);

  // Yjs document updates binary log
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      update_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_board_updates_room ON board_updates(room_id);
  `);

  // Non-destructive version history snapshots
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_versions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      node_count INTEGER DEFAULT 0,
      edge_count INTEGER DEFAULT 0,
      is_auto INTEGER DEFAULT 0,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_board_versions_room ON board_versions(room_id);
  `);
}

