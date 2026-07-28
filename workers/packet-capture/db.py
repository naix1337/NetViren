import sqlite3
import os

DB_PATH = os.environ.get('DATABASE_PATH', '/var/lib/netviren/db/netviren.db')

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
