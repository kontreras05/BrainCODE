import sqlite3
import os
from datetime import datetime

# Usar ruta absoluta para evitar problemas al ejecutar desde distintos directorios
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "metrics.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # WAL evita el archivo metrics.db-journal residual y permite lecturas
    # concurrentes sin bloquear escrituras.
    cursor.execute("PRAGMA journal_mode=WAL;")

    # Table for active window metrics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS window_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            window_title TEXT,
            category TEXT,
            duration_seconds INTEGER
        )
    ''')

    # Table for computer vision metrics (gaze, posture)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cv_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            looking_at_screen BOOLEAN,
            posture_status TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at DATETIME NOT NULL,
            ended_at DATETIME NOT NULL,
            duration_sec INTEGER NOT NULL,
            mode TEXT NOT NULL,
            score INTEGER NOT NULL,
            longest_streak_sec INTEGER NOT NULL,
            working_sec INTEGER NOT NULL,
            away_sec INTEGER NOT NULL,
            social_sec INTEGER NOT NULL,
            absent_sec INTEGER NOT NULL
        )
    ''')
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);"
    )

    conn.commit()
    conn.close()

def log_window_time(window_title, category, duration):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO window_metrics (timestamp, window_title, category, duration_seconds)
        VALUES (?, ?, ?, ?)
    ''', (datetime.now(), window_title, category, duration))
    conn.commit()
    conn.close()

def insert_session(record: dict) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO sessions
            (started_at, ended_at, duration_sec, mode, score,
             longest_streak_sec, working_sec, away_sec, social_sec, absent_sec)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record["started_at"],
            record["ended_at"],
            record["duration_sec"],
            record["mode"],
            record["score"],
            record["longest_streak_sec"],
            record["working_sec"],
            record["away_sec"],
            record["social_sec"],
            record["absent_sec"],
        ),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id

def list_sessions(since_iso: str | None = None) -> list:
    if not os.path.exists(DB_PATH):
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if since_iso:
        cursor.execute(
            "SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at DESC",
            (since_iso,),
        )
    else:
        cursor.execute("SELECT * FROM sessions ORDER BY started_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
