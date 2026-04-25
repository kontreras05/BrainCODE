import time
import pygetwindow as gw
from backend.database import log_window_time

SOCIAL_MEDIA_KEYWORDS = ["Instagram", "TikTok", "Twitter", "X", "Facebook", "YouTube", "Reddit"]

def get_active_window_title():
    try:
        active_window = gw.getActiveWindow()
        if active_window is not None:
            return active_window.title
    except Exception as e:
        print(f"Error getting active window: {e}")
    return ""

def monitor_windows():
    print("Iniciando monitorización de ventanas...")
    while True:
        title = get_active_window_title()
        
        if title:
            category = "Productivity/Other"
            for keyword in SOCIAL_MEDIA_KEYWORDS:
                if keyword.lower() in title.lower():
                    category = "Social Media"
                    break
            
            # Registramos 2 segundos a la categoría
            if category == "Social Media":
                # print(f"Red Social detectada: {title}")
                log_window_time(title, category, 2)
        
        time.sleep(2)

if __name__ == "__main__":
    monitor_windows()
