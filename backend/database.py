import sqlite3
import os
from datetime import datetime

# Usar ruta absoluta para evitar problemas al ejecutar desde distintos directorios
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "metrics.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
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

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
