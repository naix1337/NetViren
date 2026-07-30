import sqlite3
import os

DB_PATH = os.environ.get('DATABASE_PATH', '/var/lib/netviren/db/netviren.db')

_connection = None


def get_db() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DB_PATH)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
    return _connection
