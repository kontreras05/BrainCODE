import os
import sqlite3
from datetime import datetime, timedelta
import webview

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
    """Bridge exposed to JS as `window.pywebview.api`."""

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


def launch():
    api = Api()
    webview.create_window(
        "BrainCode",
        f"file://{INDEX_HTML}",
        js_api=api,
        width=940,
        height=660,
        resizable=True,
    )
    webview.start()


if __name__ == "__main__":
    launch()
