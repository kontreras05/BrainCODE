"""Debug headless del FocusTracker.

Solo para desarrollo: abre una ventana OpenCV con el frame + malla/iris e
imprime los cambios de estado por consola. NO renderiza la calibración
visual (eso ahora lo hace el frontend React); usa este script únicamente
para verificar que el tracker funciona aislado del flujo de usuario.

Uso:
    python -m backend.demo

Teclas:
    q / ESC : salir
    r       : pedir recalibración
    espacio : iniciar fase de calibración (solo si está esperando)
"""

import os
import sys
import time

import cv2

# Asegurar import del paquete backend cuando se ejecuta como script suelto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.focus_tracker import ConcentrationState, FocusTracker, OperationMode
from backend.overlay import make_overlay_renderer


def on_state_change(old_state: ConcentrationState, new_state: ConcentrationState):
    print(f"[ESTADO] {old_state.name} -> {new_state.name}")


def run_demo():
    print("Iniciando FocusTracker (debug)...")
    tracker = FocusTracker(
        camera_index=0,
        mode=OperationMode.DIGITAL,
        on_state_change=on_state_change,
    )
    tracker.start()
    tracker.start_session(camera_index=0)

    render = make_overlay_renderer()
    cv2.namedWindow("BrainCODE Tracker (debug)", cv2.WINDOW_NORMAL)

    print("q/ESC para salir, r para recalibrar, espacio para iniciar calibracion.")
    try:
        while tracker.is_running:
            frame, state = tracker.get_frame_and_state()
            if frame is None:
                time.sleep(0.05)
                continue

            rendered = render(frame, state)
            cv2.imshow("BrainCODE Tracker (debug)", rendered)

            key = cv2.waitKey(10) & 0xFF
            if key in (27, ord("q")):
                break
            elif key == ord("r"):
                tracker.request_recalibration()
                print("[CALIB] recalibracion solicitada")
            elif key == 32:
                tracker.start_calibration()
                print("[CALIB] inicio de calibracion")
    except KeyboardInterrupt:
        print("Interrupcion manual.")
    finally:
        stats = tracker.stop_session()
        tracker.stop()
        cv2.destroyAllWindows()
        print("\n--- Stats finales ---")
        for k, v in stats.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    run_demo()
