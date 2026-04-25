import cv2
import time
import sys
import os
import math
import numpy as np

# Asegurar que el directorio raíz del proyecto está en el PATH para reconocer el módulo 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.focus_tracker import FocusTracker, FocusState, ConcentrationState, OperationMode

def on_distracted(state: FocusState):
    print(f"-> Penalización de score activada. Motivo de distracción: {state.distraction_reason}")

def on_state_change(old_state: ConcentrationState, new_state: ConcentrationState):
    print(f"\n[ESTADO] Transición detectada: {old_state.name} ---> {new_state.name}")

def draw_pose_axis(img, yaw, pitch, roll, tdx=None, tdy=None, size=100):
    """ Dibuja un eje tridimensional sobre la nariz que indica visualmente hacia dónde apunta la cabeza """
    pitch = math.radians(pitch)
    yaw = math.radians(-yaw)
    roll = math.radians(roll)
    
    if tdx is None or tdy is None:
        height, width = img.shape[:2]
        tdx, tdy = width / 2, height / 2

    # Vector X (Rojo) - Derecha
    x1 = size * (math.cos(yaw) * math.cos(roll)) + tdx
    y1 = size * (math.cos(pitch) * math.sin(roll) + math.cos(roll) * math.sin(pitch) * math.sin(yaw)) + tdy
    
    # Vector Y (Verde) - Abajo
    x2 = size * (-math.cos(yaw) * math.sin(roll)) + tdx
    y2 = size * (math.cos(pitch) * math.cos(roll) - math.sin(pitch) * math.sin(yaw) * math.sin(roll)) + tdy
    
    # Vector Z (Azul) - Profundidad (Hacia la cámara)
    x3 = size * math.sin(yaw) + tdx
    y3 = size * (-math.cos(yaw) * math.sin(pitch)) + tdy

    cv2.line(img, (int(tdx), int(tdy)), (int(x1), int(y1)), (0, 0, 255), 3) # X - Red
    cv2.line(img, (int(tdx), int(tdy)), (int(x2), int(y2)), (0, 255, 0), 3) # Y - Green
    cv2.line(img, (int(tdx), int(tdy)), (int(x3), int(y3)), (255, 0, 0), 3) # Z - Blue
    
    cv2.circle(img, (int(tdx), int(tdy)), 5, (255, 255, 255), -1)
    return img

def run_demo():
    print("Iniciando Focus Tracker Demo (con overlay holográfico de seguimiento mental)...")
    tracker = FocusTracker(
        camera_index=0, 
        mode=OperationMode.DIGITAL,
        on_distracted=on_distracted,
        on_state_change=on_state_change
    )
    tracker.start()
    
    print("Presiona 'ESC' o 'q' para salir de la demo.")
    print(">>> MIRA A LA PANTALLA durante los primeros 2 segundos para calibrar la mirada <<<")
    
    try:
        while tracker.is_running:
            frame = tracker.get_debug_frame()
            if frame is None:
                time.sleep(0.1)
                continue
                
            state = tracker.get_current_state()
            data = state.raw_data
            
            h, w, _ = frame.shape
            
            # Show calibration banner if not yet calibrated
            if not tracker.is_gaze_calibrated:
                cv2.putText(frame, "CALIBRANDO... Mira a la pantalla", (20, 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)
                cv2.imshow("BrainCODE Focus Tracker", frame)
                key = cv2.waitKey(10) & 0xFF
                if key == 27 or key == ord('q'):
                    break
                continue
            
            if state.state == ConcentrationState.FOCUSED:
                color = (0, 255, 0)
            elif state.state == ConcentrationState.NOT_PRESENT:
                color = (128, 128, 128)
            else:
                color = (0, 0, 255)
                
            cv2.putText(frame, f"State: {state.state.name}", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            cv2.putText(frame, f"Score: {state.score:.1f}", (20, 80), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 200, 0), 2)
                        
            if state.state == ConcentrationState.DISTRACTED and state.distraction_reason:
                cv2.putText(frame, f"INFO: {state.distraction_reason}", (20, 115), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
            if data:
                yaw = data.get("yaw", 0)
                pitch = data.get("pitch", 0)
                roll = data.get("roll", 0)
                ear = data.get("ear", 0)
                gaze = data.get("gaze", "unknown")
                gaze_x = data.get("gaze_x", 0.0)
                gaze_y = data.get("gaze_y", 0.0)
                
                # --- WOW FACTOR: Efectos visuales de seguimiento ---
                landmarks = data.get("landmarks_2d", [])
                if landmarks:
                    # 1. Malla facial base (Puntos blancos traslúcidos)
                    for pt in landmarks:
                        cv2.circle(frame, pt, 1, (200, 200, 200), -1)
                        
                    if len(landmarks) >= 478:
                        left_iris = landmarks[473] # Ojo izquierdo del modelo
                        right_iris = landmarks[468] # Ojo derecho del modelo
                        nose_tip = landmarks[1]    # Punta de la nariz
                        
                        # 2. Resaltar retículas de Irises (Cyan Neón)
                        cv2.circle(frame, left_iris, 3, (255, 255, 0), -1)
                        cv2.circle(frame, right_iris, 3, (255, 255, 0), -1)
                        
                        # 3. Dibujar el Giroscopio de vector tridimensional (desde la nariz)
                        draw_pose_axis(frame, yaw, pitch, roll, tdx=nose_tip[0], tdy=nose_tip[1], size=70)
                # ----------------------------------------------------
                
                cv2.putText(frame, f"Yaw: {yaw:.1f} Pitch: {pitch:.1f}", (20, h - 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                cv2.putText(frame, f"Gaze Pos: [X:{gaze_x:+.3f}  Y:{gaze_y:+.3f}] | {gaze}", (20, h - 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
            cv2.imshow("BrainCODE Focus Tracker", frame)
            
            key = cv2.waitKey(10) & 0xFF
            if key == 27 or key == ord('q'):
                break
                
    except KeyboardInterrupt:
        print("\nInterrupción manual detectada.")
    finally:
        print("\n--- Finalizando Sesión ---")
        stats = tracker.end_session()
        cv2.destroyAllWindows()
        
        print("\n*** REPORTE FINAL DE SESIÓN ***")
        print(f"Puntaje Final               : {stats['final_score']:.1f}%")
        print(f"Racha de Foco más larga     : {stats['longest_focus_streak']}s")
        print(f"Tiempo Total Concentrado    : {stats['total_focused_time']}s")
        print(f"Tiempo Total Distraído      : {stats['total_distracted_time']}s")
        print(f"Tiempo Total Ausente (AFK)  : {stats['total_absent_time']}s")
        print(f"Total eventos de distracción: {len(stats['distraction_events'])}")

if __name__ == "__main__":
    run_demo()
