import Database from 'better-sqlite3';
import { getEnv } from '../config/env.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const env = getEnv();
    _db = new Database(env.DATABASE_PATH, { /* verbose: console.log */ });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');
  }
  return _db;
}
