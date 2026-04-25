import threading
import time
from backend.database import init_db
from backend.window_monitor import monitor_windows
from backend.vision_tracker import monitor_vision
import flet as ft
from frontend.app import main as frontend_main

def start_background_tasks():
    # Inicializar la base de datos
    init_db()
    
    # Iniciar el monitor de ventanas en un hilo separado (daemon para que se cierre con la app)
    window_thread = threading.Thread(target=monitor_windows, daemon=True)
    window_thread.start()
    
    # Iniciar el monitor de visión en un hilo separado
    # Descomentar la siguiente línea cuando se quiera activar la webcam
    # vision_thread = threading.Thread(target=monitor_vision, daemon=True)
    # vision_thread.start()
    print("Tareas en segundo plano iniciadas.")

if __name__ == "__main__":
    print("Iniciando BrainCODE...")
    start_background_tasks()
    
    # Iniciar la interfaz Flet (esto bloquea el hilo principal)
    ft.app(target=frontend_main)
