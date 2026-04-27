"""Drawing helpers for FocusTracker frames.

Centralised so the same overlay (mesh + iris + state border + calibration
guide) can be rendered both by the local OpenCV demo and by the MJPEG
video server consumed by the React frontend.
"""

import time
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import mediapipe as mp

from backend.focus_tracker import CalibrationPhase, ConcentrationState, FocusState

# ── Colors (BGR) ─────────────────────────────────────────────────
COL_GREEN = (0, 230, 118)
COL_RED = (70, 70, 240)
COL_GRAY = (160, 160, 160)
COL_MESH = (130, 105, 65)
COL_IRIS = (255, 200, 50)
COL_TEXT = (255, 255, 255)

CORNER_LABELS = {
    CalibrationPhase.TOP_LEFT: "ESQUINA SUPERIOR IZQUIERDA",
    CalibrationPhase.TOP_RIGHT: "ESQUINA SUPERIOR DERECHA",
    CalibrationPhase.BOTTOM_RIGHT: "ESQUINA INFERIOR DERECHA",
    CalibrationPhase.BOTTOM_LEFT: "ESQUINA INFERIOR IZQUIERDA",
}

ENV_WARNINGS = {
    "too_dark": "Aviso: poca luz - acercate a una fuente luminosa",
    "barely_visible": "Aviso: tu cara apenas se detecta - acomodate frente a la camara",
    "moved_closer": "Aviso: te has acercado respecto a tu postura calibrada",
    "moved_further": "Aviso: te has alejado respecto a tu postura calibrada",
}


def _put_centered_text(img, text, y_pos, font_scale=0.7, thickness=2, color=COL_TEXT):
    font = cv2.FONT_HERSHEY_DUPLEX
    text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
    x_pos = (img.shape[1] - text_size[0]) // 2
    cv2.putText(img, text, (x_pos + 2, y_pos + 2), font, font_scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    cv2.putText(img, text, (x_pos, y_pos), font, font_scale, color, thickness, cv2.LINE_AA)


def _corner_positions(w, h, margin=70):
    return {
        CalibrationPhase.TOP_LEFT: (margin, margin),
        CalibrationPhase.TOP_RIGHT: (w - margin, margin),
        CalibrationPhase.BOTTOM_RIGHT: (w - margin, h - margin),
        CalibrationPhase.BOTTOM_LEFT: (margin, h - margin),
    }


def _draw_calibration(frame, phase: CalibrationPhase, progress: float, environment: Optional[Dict]):
    h, w, _ = frame.shape

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    cx, cy = w // 2, h // 2

    if phase == CalibrationPhase.WAITING_TO_START:
        _put_centered_text(frame, "CALIBRACION NECESARIA", h // 2 - 60, 1.0, 2, (0, 200, 255))
        _put_centered_text(frame, "Adopta tu postura habitual de trabajo", h // 2 - 10, 0.75, 2, (0, 230, 255))
        _put_centered_text(frame, "(esa sera tu posicion de referencia)", h // 2 + 25, 0.6, 2, (180, 180, 180))
        _put_centered_text(frame, "Pulsa Empezar calibracion en la app", h // 2 + 70, 0.7, 2)
        if environment and environment.get("warning") in ENV_WARNINGS:
            _put_centered_text(frame, ENV_WARNINGS[environment["warning"]], h - 90, 0.6, 2, (0, 165, 255))

    elif phase == CalibrationPhase.CENTER:
        _put_centered_text(frame, "MIRA AL CENTRO DE LA PANTALLA", 60, 0.9, 2, (0, 255, 0))
        _put_centered_text(frame, "Mantente inmovil con la cabeza recta", 95, 0.6, 2)
        pulse = int(8 * (1 + np.sin(time.time() * 4)))
        cv2.circle(frame, (cx, cy), 25 + pulse, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.circle(frame, (cx, cy), 6, (0, 255, 0), -1, cv2.LINE_AA)

    elif phase in CORNER_LABELS:
        positions = _corner_positions(w, h)
        target_pos = positions[phase]

        for ph, pos in positions.items():
            if ph != phase:
                cv2.circle(frame, pos, 18, (90, 90, 90), 1, cv2.LINE_AA)

        cv2.line(frame, (cx, cy), target_pos, (0, 200, 255), 1, cv2.LINE_AA)

        pulse = int(10 * (1 + np.sin(time.time() * 5)))
        cv2.circle(frame, target_pos, 35 + pulse, (0, 200, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, target_pos, 25, (0, 200, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, target_pos, 8, (0, 230, 255), -1, cv2.LINE_AA)

        dx, dy = target_pos[0] - cx, target_pos[1] - cy
        dist = float(np.hypot(dx, dy))
        if dist > 1e-3:
            tail = (int(target_pos[0] - dx / dist * 80), int(target_pos[1] - dy / dist * 80))
            head = (int(target_pos[0] - dx / dist * 50), int(target_pos[1] - dy / dist * 50))
            cv2.arrowedLine(frame, tail, head, (0, 220, 255), 2, cv2.LINE_AA, tipLength=0.5)

        _put_centered_text(frame, "MIRA A LA " + CORNER_LABELS[phase], 50, 0.85, 2, (0, 200, 255))
        _put_centered_text(frame, "Sigue el circulo con la mirada", 85, 0.6, 2)

    if phase != CalibrationPhase.WAITING_TO_START:
        bar_w = 400
        bar_h = 20
        bar_x = (w - bar_w) // 2
        bar_y = h - 50
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 80, 80), -1)
        fill_w = int(bar_w * max(0.0, min(1.0, progress)))
        if fill_w > 0:
            cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), (0, 200, 255), -1)
        _put_centered_text(frame, f"{int(progress * 100)}%", bar_y - 8, 0.55, 2, (0, 200, 255))


def _state_color(state: ConcentrationState) -> Tuple[int, int, int]:
    if state == ConcentrationState.FOCUSED:
        return COL_GREEN
    if state == ConcentrationState.NOT_PRESENT:
        return COL_GRAY
    return COL_RED


class _LandmarkSmoother:
    """Exponential moving average over landmark coordinates to reduce jitter."""

    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self._smooth: Optional[List[Tuple[float, float]]] = None

    def smooth(self, raw: List[Tuple[float, float]]) -> List[Tuple[int, int]]:
        if self._smooth is None or len(self._smooth) != len(raw):
            self._smooth = [(float(x), float(y)) for x, y in raw]
        else:
            a = self.alpha
            self._smooth = [
                (a * rx + (1 - a) * sx, a * ry + (1 - a) * sy)
                for (rx, ry), (sx, sy) in zip(raw, self._smooth)
            ]
        return [(int(x), int(y)) for x, y in self._smooth]


def make_overlay_renderer(render_scale: int = 2, smooth_alpha: float = 0.5):
    """Factory that returns a stateful render(frame, state, tracker) -> frame.

    State kept across frames: smoothed landmarks and last valid landmarks
    (so the mesh keeps drawing even when MediaPipe drops a frame).
    """
    smoother = _LandmarkSmoother(alpha=smooth_alpha)
    cached_landmarks: List[Tuple[int, int]] = []

    def render(frame, state: FocusState, calibration_phase: CalibrationPhase,
               calibration_progress: float, is_fully_calibrated: bool,
               environment: Optional[Dict], recalibration_suggested: bool):
        nonlocal cached_landmarks

        frame = cv2.resize(frame, None, fx=render_scale, fy=render_scale, interpolation=cv2.INTER_CUBIC)
        h, w, _ = frame.shape

        data = state.raw_data or {}
        if "landmarks_2d" in data and data["landmarks_2d"]:
            raw_lm = [(x * render_scale, y * render_scale) for x, y in data["landmarks_2d"]]
        else:
            raw_lm = cached_landmarks

        if raw_lm:
            landmarks = smoother.smooth(raw_lm)
            cached_landmarks = landmarks

            for connection in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION:
                pt1 = landmarks[connection.start]
                pt2 = landmarks[connection.end]
                cv2.line(frame, pt1, pt2, COL_MESH, 1, cv2.LINE_AA)

            if len(landmarks) >= 478:
                left_iris = landmarks[473]
                right_iris = landmarks[468]
                cv2.circle(frame, left_iris, 3, COL_IRIS, 1, cv2.LINE_AA)
                cv2.circle(frame, left_iris, 1, COL_IRIS, -1, cv2.LINE_AA)
                cv2.circle(frame, right_iris, 3, COL_IRIS, 1, cv2.LINE_AA)
                cv2.circle(frame, right_iris, 1, COL_IRIS, -1, cv2.LINE_AA)

        if not is_fully_calibrated:
            _draw_calibration(frame, calibration_phase, calibration_progress, environment)
        else:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), _state_color(state.state), 2)
            if recalibration_suggested:
                _put_centered_text(frame, "Tu postura ha cambiado mucho", 30, 0.6, 2, (0, 200, 255))
                _put_centered_text(frame, "Pulsa Recalibrar en la app", 60, 0.6, 2, (0, 220, 255))
            elif environment and environment.get("warning") in ENV_WARNINGS:
                _put_centered_text(frame, ENV_WARNINGS[environment["warning"]], 30, 0.55, 2, (0, 165, 255))

        return frame

    return render
