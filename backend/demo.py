import cv2
import time
import sys
import os
import numpy as np
import mediapipe as mp

# Asegurar que el directorio raíz del proyecto está en el PATH para reconocer el módulo 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.focus_tracker import FocusTracker, FocusState, ConcentrationState, OperationMode, CalibrationPhase

# ── Colors (BGR) ─────────────────────────────────────────────────
COL_GREEN  = (0, 230, 118)
COL_RED    = (70, 70, 240)
COL_GRAY   = (160, 160, 160)
COL_MESH   = (130, 105, 65)     # Subtle #59A5D8 at ~40% visual intensity
COL_IRIS   = (255, 200, 50)
COL_TEXT   = (255, 255, 255)

# ── Render quality ────────────────────────────────────────────────
# Supersampling: draw overlays at 2x the camera resolution for crisp
# lines, text and mesh even when the window is resized or fullscreen.
RENDER_SCALE = 2

def put_centered_text(img, text, y_pos, font_scale=0.7, thickness=2, color=COL_TEXT):
    font = cv2.FONT_HERSHEY_DUPLEX
    text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
    x_pos = (img.shape[1] - text_size[0]) // 2
    
    # Text shadow
    cv2.putText(img, text, (x_pos + 2, y_pos + 2), font, font_scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    # Actual text
    cv2.putText(img, text, (x_pos, y_pos), font, font_scale, color, thickness, cv2.LINE_AA)

CORNER_LABELS = {
    CalibrationPhase.TOP_LEFT:     "ESQUINA SUPERIOR IZQUIERDA",
    CalibrationPhase.TOP_RIGHT:    "ESQUINA SUPERIOR DERECHA",
    CalibrationPhase.BOTTOM_RIGHT: "ESQUINA INFERIOR DERECHA",
    CalibrationPhase.BOTTOM_LEFT:  "ESQUINA INFERIOR IZQUIERDA",
}

ENV_WARNINGS = {
    "too_dark":       "Aviso: poca luz - acercate a una fuente luminosa",
    "barely_visible": "Aviso: tu cara apenas se detecta - acomodate frente a la camara",
    "moved_closer":   "Aviso: te has acercado respecto a tu postura calibrada",
    "moved_further":  "Aviso: te has alejado respecto a tu postura calibrada",
}

def _corner_positions(w, h, margin=70):
    return {
        CalibrationPhase.TOP_LEFT:     (margin,     margin),
        CalibrationPhase.TOP_RIGHT:    (w - margin, margin),
        CalibrationPhase.BOTTOM_RIGHT: (w - margin, h - margin),
        CalibrationPhase.BOTTOM_LEFT:  (margin,     h - margin),
    }

def draw_calibration_overlay(frame, phase, progress, environment=None):
    h, w, _ = frame.shape

    # Semi-transparent dark overlay for readability
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    cx, cy = w // 2, h // 2

    if phase == CalibrationPhase.WAITING_TO_START:
        put_centered_text(frame, "CALIBRACION NECESARIA", h // 2 - 60, 1.0, 2, (0, 200, 255))
        put_centered_text(frame, "Adopta tu postura habitual de trabajo", h // 2 - 10, 0.75, 2, (0, 230, 255))
        put_centered_text(frame, "(esa sera tu posicion de referencia)",  h // 2 + 25, 0.6, 2, (180, 180, 180))
        put_centered_text(frame, "Presiona ESPACIO o ENTER para iniciar", h // 2 + 70, 0.7, 2)
        if environment and environment.get("warning") in ENV_WARNINGS:
            put_centered_text(frame, ENV_WARNINGS[environment["warning"]], h - 90, 0.6, 2, (0, 165, 255))

    elif phase == CalibrationPhase.CENTER:
        put_centered_text(frame, "MIRA AL CENTRO DE LA PANTALLA", 60, 0.9, 2, (0, 255, 0))
        put_centered_text(frame, "Mantente inmovil con la cabeza recta", 95, 0.6, 2)
        pulse = int(8 * (1 + np.sin(time.time() * 4)))
        cv2.circle(frame, (cx, cy), 25 + pulse, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.circle(frame, (cx, cy), 6, (0, 255, 0), -1, cv2.LINE_AA)

    elif phase in CORNER_LABELS:
        positions = _corner_positions(w, h)
        target_pos = positions[phase]

        # Dim other corners to anchor visual context
        for ph, pos in positions.items():
            if ph != phase:
                cv2.circle(frame, pos, 18, (90, 90, 90), 1, cv2.LINE_AA)

        # Guide line from center to target
        cv2.line(frame, (cx, cy), target_pos, (0, 200, 255), 1, cv2.LINE_AA)

        # Pulsing target rings
        pulse = int(10 * (1 + np.sin(time.time() * 5)))
        cv2.circle(frame, target_pos, 35 + pulse, (0, 200, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, target_pos, 25, (0, 200, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, target_pos, 8,  (0, 230, 255), -1, cv2.LINE_AA)

        # Arrow tip pointing into target along the guide line
        dx, dy = target_pos[0] - cx, target_pos[1] - cy
        dist = float(np.hypot(dx, dy))
        if dist > 1e-3:
            tail = (int(target_pos[0] - dx / dist * 80), int(target_pos[1] - dy / dist * 80))
            head = (int(target_pos[0] - dx / dist * 50), int(target_pos[1] - dy / dist * 50))
            cv2.arrowedLine(frame, tail, head, (0, 220, 255), 2, cv2.LINE_AA, tipLength=0.5)

        put_centered_text(frame, "MIRA A LA " + CORNER_LABELS[phase], 50, 0.85, 2, (0, 200, 255))
        put_centered_text(frame, "Sigue el circulo con la mirada", 85, 0.6, 2)

    # Progress bar (skip when just waiting)
    if phase != CalibrationPhase.WAITING_TO_START:
        bar_w = 400
        bar_h = 20
        bar_x = (w - bar_w) // 2
        bar_y = h - 50
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 80, 80), -1)
        fill_w = int(bar_w * progress)
        if fill_w > 0:
            cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), (0, 200, 255), -1)
        put_centered_text(frame, f"{int(progress * 100)}%", bar_y - 8, 0.55, 2, (0, 200, 255))

def on_distracted(state: FocusState):
    print(f"-> Penalización de score activada. Motivo de distracción: {state.distraction_reason}")

def on_state_change(old_state: ConcentrationState, new_state: ConcentrationState):
    print(f"\n[ESTADO] Transición detectada: {old_state.name} ---> {new_state.name}")

def run_demo():
    print("Iniciando Focus Tracker Demo...")
    tracker = FocusTracker(
        camera_index=0, 
        mode=OperationMode.DIGITAL,
        on_distracted=on_distracted,
        on_state_change=on_state_change
    )
    tracker.start()
    
    print("Presiona 'ESC' o 'q' para salir de la demo.")
    print("Presiona 'f' para alternar pantalla completa.")
    
    cv2.namedWindow("BrainCODE Focus Tracker", cv2.WINDOW_NORMAL)
    
    # Landmark smoothing state (persists across loop iterations)
    smooth_landmarks = None  # will hold smoothed (x, y) list
    SMOOTH_ALPHA = 0.5       # 0 = fully smoothed (sticky), 1 = no smoothing (raw)
    cached_landmarks = None  # last valid landmarks for fallback
    
    try:
        while tracker.is_running:
            frame, state = tracker.get_frame_and_state()
            if frame is None:
                time.sleep(0.1)
                continue
                
            data = state.raw_data
            
            # ── Upscale for crisp rendering ──────────────────────
            frame = cv2.resize(frame, None, fx=RENDER_SCALE, fy=RENDER_SCALE, interpolation=cv2.INTER_CUBIC)
            h, w, _ = frame.shape
            
            # Scale landmark coordinates to match upscaled frame
            if data and "landmarks_2d" in data and data["landmarks_2d"]:
                raw_lm = [(x * RENDER_SCALE, y * RENDER_SCALE) for x, y in data["landmarks_2d"]]
                cached_landmarks = raw_lm
            else:
                raw_lm = cached_landmarks  # reuse last valid
            
            # ── State color for border ──────────────────────────
            if state.state == ConcentrationState.FOCUSED:
                state_color = COL_GREEN
            elif state.state == ConcentrationState.NOT_PRESENT:
                state_color = COL_GRAY
            else:
                state_color = COL_RED
            
            # ── Face landmarks & iris ───────────────────────────
            if raw_lm:
                # Temporal smoothing: exponential moving average per landmark
                if smooth_landmarks is None or len(smooth_landmarks) != len(raw_lm):
                    smooth_landmarks = list(raw_lm)
                else:
                    smooth_landmarks = [
                        (SMOOTH_ALPHA * rx + (1 - SMOOTH_ALPHA) * sx,
                         SMOOTH_ALPHA * ry + (1 - SMOOTH_ALPHA) * sy)
                        for (rx, ry), (sx, sy) in zip(raw_lm, smooth_landmarks)
                    ]
                
                # Convert to int for drawing
                landmarks = [(int(x), int(y)) for x, y in smooth_landmarks]
                
                # Draw wireframe directly on frame (no addWeighted copy)
                for connection in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION:
                    pt1 = landmarks[connection.start]
                    pt2 = landmarks[connection.end]
                    cv2.line(frame, pt1, pt2, COL_MESH, 1, cv2.LINE_AA)
                    
                if len(landmarks) >= 478:
                    left_iris = landmarks[473]
                    right_iris = landmarks[468]
                    
                    # Iris highlights
                    cv2.circle(frame, left_iris, 3, COL_IRIS, 1, cv2.LINE_AA)
                    cv2.circle(frame, left_iris, 1, COL_IRIS, -1, cv2.LINE_AA)
                    cv2.circle(frame, right_iris, 3, COL_IRIS, 1, cv2.LINE_AA)
                    cv2.circle(frame, right_iris, 1, COL_IRIS, -1, cv2.LINE_AA)
            
            # ── Calibration Overlay ─────────────────────────────
            if not tracker.is_fully_calibrated:
                draw_calibration_overlay(
                    frame,
                    tracker.calibration_phase,
                    tracker.calibration_progress,
                    environment=tracker.environment_status,
                )
            else:
                # ── Thin colored border (state indicator) ───────────
                cv2.rectangle(frame, (0, 0), (w - 1, h - 1), state_color, 2)

                # ── Posture / lighting drift hint (non-blocking) ────
                env = tracker.environment_status
                if tracker.recalibration_suggested:
                    put_centered_text(frame, "Tu postura ha cambiado mucho", 30, 0.6, 2, (0, 200, 255))
                    put_centered_text(frame, "Presiona R para recalibrar", 60, 0.6, 2, (0, 220, 255))
                elif env and env.get("warning") in ENV_WARNINGS:
                    msg = ENV_WARNINGS[env["warning"]]
                    put_centered_text(frame, msg, 30, 0.55, 2, (0, 165, 255))
            
            cv2.imshow("BrainCODE Focus Tracker", frame)
            
            key = cv2.waitKey(10) & 0xFF
            if key == 27 or key == ord('q'):
                break
            elif key == ord('f'):
                prop = cv2.getWindowProperty("BrainCODE Focus Tracker", cv2.WND_PROP_FULLSCREEN)
                if prop == cv2.WINDOW_FULLSCREEN:
                    cv2.setWindowProperty("BrainCODE Focus Tracker", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL)
                else:
                    cv2.setWindowProperty("BrainCODE Focus Tracker", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
            elif key == 32 or key == 13: # Space or Enter
                tracker.start_calibration()
            elif key == ord('r') and tracker.recalibration_suggested:
                # Only honor 'R' when the recalibration prompt is showing,
                # so stray keystrokes during background use don't reset calibration.
                tracker.request_recalibration()
                
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
