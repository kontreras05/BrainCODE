import time
from typing import Callable, Optional

import pygetwindow as gw

from backend.database import log_window_time

SOCIAL_MEDIA_KEYWORDS = ["Instagram", "TikTok", "Twitter", "X", "Facebook", "YouTube", "Reddit"]


def get_active_window_title() -> str:
    try:
        active_window = gw.getActiveWindow()
        if active_window is not None:
            return active_window.title
    except Exception as e:
        print(f"Error getting active window: {e}")
    return ""


def _classify(title: str) -> str:
    if not title:
        return "Unknown"
    import re
    for keyword in SOCIAL_MEDIA_KEYWORDS:
        # Usamos \b para asegurar que el keyword sea una palabra completa
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, title, re.IGNORECASE):
            return "Social Media"
    return "Productivity/Other"


def monitor_windows(on_category_change: Optional[Callable[[str], None]] = None):
    print("Iniciando monitorización de ventanas...")
    last_category: Optional[str] = None
    while True:
        title = get_active_window_title()
        category = _classify(title)

        if on_category_change is not None and category != last_category:
            try:
                on_category_change(category)
            except Exception as e:
                print(f"Error en on_category_change: {e}")
            last_category = category

        if title and category == "Social Media":
            log_window_time(title, category, 2)

        time.sleep(2)


if __name__ == "__main__":
    monitor_windows()
