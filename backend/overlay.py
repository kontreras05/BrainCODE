"""Drawing helpers for FocusTracker frames.

Pinta SOLO la malla facial y los iris sobre el frame del MJPEG. Todo lo
demás (calibración fullscreen, borde de estado, avisos de entorno) se
renderiza ahora en el frontend React, así el video se mantiene 30fps
sincronizado con la cara y la UI estática vive en el DOM.
"""

from typing import List, Optional, Tuple

import cv2
import mediapipe as mp

from backend.focus_tracker import FocusState

# ── Colors (BGR) ─────────────────────────────────────────────────
COL_MESH = (130, 105, 65)
COL_IRIS = (255, 200, 50)


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
    """Factory that returns a stateful render(frame, state) -> frame.

    Upscales the frame for crisp lines, smooths landmarks across frames,
    keeps the last valid set so the mesh doesn't flicker when MediaPipe
    drops a frame.
    """
    smoother = _LandmarkSmoother(alpha=smooth_alpha)
    cached_landmarks: List[Tuple[int, int]] = []

    def render(frame, state: FocusState):
        nonlocal cached_landmarks

        frame = cv2.resize(frame, None, fx=render_scale, fy=render_scale, interpolation=cv2.INTER_CUBIC)

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

        return frame

    return render
