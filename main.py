import threading

from backend.database import init_db
from backend.window_monitor import monitor_windows
from backend.focus_tracker import FocusTracker
from backend.video_server import start_video_server
from frontend.app import launch as launch_ui


def on_distracted(state):
    print(f"[ALERTA] Usuario distraído: {state.distraction_reason}")


def start_background_tasks():
    init_db()

    tracker = FocusTracker(on_distracted=on_distracted)
    tracker.start()

    threading.Thread(
        target=monitor_windows,
        kwargs={"on_category_change": tracker.set_active_window_category},
        daemon=True,
        name="window_monitor",
    ).start()

    start_video_server(tracker)

    print("Tareas en segundo plano iniciadas (FocusTracker + window_monitor + video_server).")
    return tracker


if __name__ == "__main__":
    print("Iniciando BrainCODE...")
    tracker = start_background_tasks()

    try:
        launch_ui(tracker)
    finally:
        print("Cerrando BrainCODE...")
        tracker.stop()
