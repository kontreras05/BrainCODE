import threading

from backend.database import init_db
from backend.window_monitor import monitor_windows
from frontend.app import launch as launch_ui


def start_background_tasks():
    init_db()
    threading.Thread(target=monitor_windows, daemon=True).start()
    # Activar visión por computadora cuando esté listo:
    # from backend.vision_tracker import monitor_vision
    # threading.Thread(target=monitor_vision, daemon=True).start()
    print("Tareas en segundo plano iniciadas.")


if __name__ == "__main__":
    print("Iniciando BrainCODE...")
    start_background_tasks()
    launch_ui()
