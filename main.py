import threading
import time

from backend.database import init_db
from backend.window_monitor import monitor_windows
from backend.focus_tracker import FocusTracker, ConcentrationState
from frontend.app import launch as launch_ui

def on_distracted(state):
    print(f"[ALERTA] Usuario distraído: {state.distraction_reason}")

def start_background_tasks():
    init_db()
    threading.Thread(target=monitor_windows, daemon=True).start()
    
    # Inicializar y arrancar el tracker de foco
    tracker = FocusTracker(on_distracted=on_distracted)
    tracker.start()
    
    print("Tareas en segundo plano iniciadas (incluyendo FocusTracker).")
    return tracker

if __name__ == "__main__":
    print("Iniciando BrainCODE...")
    tracker = start_background_tasks()
    
    try:
        launch_ui()
    finally:
        print("Cerrando BrainCODE...")
        tracker.stop()
