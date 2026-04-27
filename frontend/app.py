import os
import sqlite3
from datetime import datetime
from pathlib import Path

import webview

from backend.video_server import get_video_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "metrics.db")
INDEX_HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")

CATEGORY_TO_STATE = {
    "Productive": "working",
    "Work": "working",
    "Code": "working",
    "Social Media": "social",
    "Entertainment": "away",
    "Idle": "absent",
    "Unknown": "away",
}


def _connect():
    return sqlite3.connect(DB_PATH)


def _seconds_by_category(since: datetime):
    if not os.path.exists(DB_PATH):
        return {}
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT category, SUM(duration_seconds) FROM window_metrics "
        "WHERE timestamp >= ? GROUP BY category",
        (since.isoformat(sep=" "),),
    )
    rows = cur.fetchall()
    conn.close()
    return {cat or "Unknown": int(total or 0) for cat, total in rows}


class Api:
    """Bridge exposed to JS as `window.pywebview.api`.

    Wires the React frontend to:
      • SQLite metrics (existing today/hourly endpoints)
      • Live FocusTracker state (state + segments + calibration)
      • Session control (start/stop/calibrate)
    """

    def __init__(self, tracker=None):
        self._tracker = tracker

    # ── Historic metrics (unchanged) ─────────────────────────────

    def get_today_metrics(self):
        start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        by_cat = _seconds_by_category(start)

        totals = {"working": 0, "away": 0, "social": 0, "absent": 0}
        for cat, secs in by_cat.items():
            state = CATEGORY_TO_STATE.get(cat, "away")
            totals[state] += secs

        total_secs = sum(totals.values())
        active_secs = totals["working"]
        score_pct = int(round(100 * active_secs / total_secs)) if total_secs else 0

        return {
            "score_pct": score_pct,
            "active_minutes": active_secs // 60,
            "totals_seconds": totals,
            "raw_by_category": by_cat,
            "has_data": total_secs > 0,
        }

    def get_hourly_breakdown(self):
        if not os.path.exists(DB_PATH):
            return []
        start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        conn = _connect()
        cur = conn.cursor()
        cur.execute(
            "SELECT timestamp, category, duration_seconds FROM window_metrics "
            "WHERE timestamp >= ?",
            (start.isoformat(sep=" "),),
        )
        rows = cur.fetchall()
        conn.close()

        buckets = {}
        for ts, cat, dur in rows:
            try:
                dt = datetime.fromisoformat(ts)
            except (TypeError, ValueError):
                continue
            hour = dt.hour
            state = CATEGORY_TO_STATE.get(cat or "", "away")
            buckets.setdefault(hour, {"working": 0, "away": 0, "social": 0, "absent": 0})
            buckets[hour][state] += int(dur or 0)

        out = []
        for hour in sorted(buckets):
            b = buckets[hour]
            total = sum(b.values()) or 1
            out.append({
                "h": f"{hour}h",
                "w": b["working"] / total,
                "a": b["away"] / total,
                "s": b["social"] / total,
                "ab": b["absent"] / total,
            })
        return out

    # ── Live FocusTracker bridge ─────────────────────────────────

    def get_video_url(self):
        return get_video_url()

    def get_live_state(self):
        if self._tracker is None:
            return None
        try:
            return self._tracker.get_live_state()
        except Exception as e:
            print(f"[Api.get_live_state] {e}")
            return None

    def start_session(self):
        """Reset session-scoped state so the user can start a fresh session
        (calibration goes back to WAITING_TO_START, buckets cleared)."""
        if self._tracker is None:
            return {"ok": False, "error": "no_tracker"}
        try:
            if not self._tracker.is_running:
                self._tracker.start()
            else:
                self._tracker.reset_session()
            return {"ok": True, "video_url": get_video_url()}
        except Exception as e:
            print(f"[Api.start_session] {e}")
            return {"ok": False, "error": str(e)}

    def stop_session(self):
        """Snapshot session stats but keep the tracker (and camera) alive."""
        if self._tracker is None:
            return None
        try:
            return self._tracker.get_session_stats()
        except Exception as e:
            print(f"[Api.stop_session] {e}")
            return None

    def start_calibration(self):
        if self._tracker is None:
            return {"ok": False}
        self._tracker.start_calibration()
        return {"ok": True}

    def request_recalibration(self):
        if self._tracker is None:
            return {"ok": False}
        self._tracker.request_recalibration()
        return {"ok": True}

    # ── Camera selection ─────────────────────────────────────────

    def list_cameras(self):
        """Return a list of available cameras [{index, name}, ...]."""
        from backend.focus_tracker import FocusTracker
        try:
            cameras = FocusTracker.list_cameras()
            current = self._tracker.camera_index if self._tracker else 0
            return {"cameras": cameras, "current": current}
        except Exception as e:
            print(f"[Api.list_cameras] {e}")
            return {"cameras": [], "current": 0}

    def set_camera(self, index: int):
        """Change the active camera index."""
        if self._tracker is None:
            return {"ok": False, "error": "no_tracker"}
        try:
            self._tracker.change_camera(int(index))
            return {"ok": True, "camera_index": int(index)}
        except Exception as e:
            print(f"[Api.set_camera] {e}")
            return {"ok": False, "error": str(e)}


def launch(tracker=None):
    api = Api(tracker=tracker)
    webview.create_window(
        "BrainCode",
        Path(INDEX_HTML).as_uri(),
        js_api=api,
        width=940,
        height=660,
        resizable=True,
    )
    webview.start()


if __name__ == "__main__":
    launch()
