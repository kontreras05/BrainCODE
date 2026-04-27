import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import time
import threading
import math
import os
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Optional, Dict, List
from enum import Enum
from collections import deque
import concurrent.futures

class CalibrationPhase(Enum):
    WAITING_TO_START = 0
    CENTER = 1
    TOP_LEFT = 2
    TOP_RIGHT = 3
    BOTTOM_RIGHT = 4
    BOTTOM_LEFT = 5
    CALIBRATED = 6

CORNER_PHASES = (
    CalibrationPhase.TOP_LEFT,
    CalibrationPhase.TOP_RIGHT,
    CalibrationPhase.BOTTOM_RIGHT,
    CalibrationPhase.BOTTOM_LEFT,
)

class OperationMode(Enum):
    DIGITAL = "DIGITAL"
    HYBRID = "HYBRID"

class ConcentrationState(Enum):
    FOCUSED = "FOCUSED"
    DISTRACTED = "DISTRACTED"
    NOT_PRESENT = "NOT_PRESENT"

@dataclass
class FocusState:
    state: ConcentrationState = ConcentrationState.FOCUSED
    score: float = 100.0
    distraction_reason: Optional[str] = None
    raw_data: Dict = field(default_factory=dict)
    
    @property
    def is_focused(self) -> bool:
        return self.state == ConcentrationState.FOCUSED

# Descargas automáticas de modelos de MediaPipe
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

GESTURE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
GESTURE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "gesture_recognizer.task")

def download_models():
    if not os.path.exists(MODEL_PATH):
        print(f"Descargando modelo face_landmarker.task (se hace solo una vez)...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    if not os.path.exists(GESTURE_MODEL_PATH):
        print(f"Descargando modelo gesture_recognizer.task (se hace solo una vez)...")
        urllib.request.urlretrieve(GESTURE_MODEL_URL, GESTURE_MODEL_PATH)

class FocusTracker:
    def __init__(
        self,
        camera_index: int = 0,
        mode: OperationMode = OperationMode.DIGITAL,
        pomodoro_duration: int = 1500,
        distraction_grace_period: float = 1.5,
        focus_bonus_streak: int = 300,
        on_distracted=None,
        on_state_change=None
    ):
        self.camera_index = camera_index
        self.mode = mode
        self.pomodoro_duration = pomodoro_duration
        self.distraction_grace_period = distraction_grace_period
        self.focus_bonus_streak = focus_bonus_streak
        self.on_distracted = on_distracted
        self.on_state_change = on_state_change
        
        self.is_running = False
        self._thread = None
        self._state_lock = threading.Lock()
        self._current_state = FocusState()
        self._last_frame = None
        self._last_valid_landmarks = []
        
        # State Confirmation System
        self._current_confirmed_state = ConcentrationState.FOCUSED
        self._candidate_state = ConcentrationState.FOCUSED
        self._candidate_since = time.time()
        self._candidate_reason = None
        
        # Session Analytics and Scoring
        self._score = 100.0
        self._last_score_update_time = time.time()
        self._last_stats_update_time = time.time()
        
        self._total_focused_time = 0.0
        self._total_distracted_time = 0.0
        self._total_absent_time = 0.0
        self._current_focus_streak = 0.0
        self._longest_focus_streak = 0.0
        self._distraction_events = []

        # Per-bucket session time used by the frontend Ring.
        # Mapping (computed in _update_candidate from confirmed state + active window):
        #   FOCUSED + Social Media window → social
        #   FOCUSED + other window        → working
        #   DISTRACTED                    → away
        #   NOT_PRESENT                   → absent
        self._segment_seconds = {"working": 0.0, "away": 0.0, "social": 0.0, "absent": 0.0}
        self._active_window_category: Optional[str] = None
        
        download_models()
        
        # --- Face Landmarker ---
        base_options_face = python.BaseOptions(model_asset_path=MODEL_PATH)
        options_face = vision.FaceLandmarkerOptions(
            base_options=base_options_face,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1
        )
        self.detector = vision.FaceLandmarker.create_from_options(options_face)
        
        # --- Gesture Recognizer ---
        base_options_gesture = python.BaseOptions(model_asset_path=GESTURE_MODEL_PATH)
        options_gesture = vision.GestureRecognizerOptions(
            base_options=base_options_gesture,
            num_hands=2
        )
        self.gesture_recognizer = vision.GestureRecognizer.create_from_options(options_gesture)
        
        # --- Concurrency ---
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        
        self._last_yaw = 0
        self._last_pitch = 0
        self._last_roll = 0
        
        # Blink duration filter (ignore blinks < 0.5s)
        self._eyes_closed_since = None
        self._blink_min_duration = 0.5  # seconds — normal blink is ~200ms
        
        # --- Gesture Tracking State ---
        self._last_gesture_by_hand = {}  # {hand_id: (gesture_name, timestamp)}
        self._hand_x_history = {}        # {hand_id: deque(timestamps, x_positions)}
        self._clap_events = []           # timestamps of claps
        self._last_hands_dist = 1.0
        self._detected_gestures = set()  # To avoid spamming, store gestures here briefly
        
        # =====================================================
        # GUIDED 5-PHASE CALIBRATION SYSTEM
        # =====================================================
        self.calibration_phase = CalibrationPhase.WAITING_TO_START

        self._calib_frames_center = 60   # ~2s look center
        self._calib_frames_corner = 45   # ~1.5s per corner (4 corners = 6s total)

        self._calib_samples_center_gaze = []
        self._calib_samples_center_head = []
        self._calib_samples_center_blink = []
        self._calib_samples_center_face_ratio = []
        self._calib_samples_corners = {p: [] for p in CORNER_PHASES}

        self._gaze_baseline_h = 0.0
        self._gaze_baseline_v = 0.0
        self._head_baseline_yaw = 0.0
        self._head_baseline_pitch = 0.0
        # Posture reference: face width / frame width when user sat naturally during CENTER
        self._face_ratio_baseline = 0.0
        # Drift tolerance vs baseline before warning (e.g. 0.30 → ±30%)
        self._posture_drift_tolerance = 0.30
        # Sustained-drift tracking → triggers a recalibration suggestion
        self._drift_warning_since: Optional[float] = None
        self._drift_persist_threshold = 10.0  # seconds of continuous drift

        # Asymmetric gaze thresholds (one per direction)
        self._gaze_threshold_left = 0.15
        self._gaze_threshold_right = 0.15
        self._gaze_threshold_up = 0.20
        self._gaze_threshold_down = 0.20
        self._gaze_min_threshold_h = 0.08
        self._gaze_min_threshold_v = 0.10

        self._head_yaw_threshold = 25
        self._head_pitch_up_threshold = 20
        self._head_pitch_down_threshold = 35

        # Calibrated blink threshold (per-user; some users have heavier eyelids)
        self._blink_threshold = 0.5

        # Environment hints (lighting / face distance) — exposed to UI during WAITING
        self._environment_status = {
            "brightness": 0.0,
            "face_ratio": 0.0,
            "drift_pct": 0.0,
            "warning": None,
        }
        
        # --- Temporal smoothing for gaze (moving average) ---
        self._gaze_history_size = 5
        self._gaze_h_history = deque(maxlen=self._gaze_history_size)
        self._gaze_v_history = deque(maxlen=self._gaze_history_size)
        
        # --- Gaze voting system: require N of last M frames off-screen ---
        self._gaze_vote_window = 8   # look at last M frames
        self._gaze_vote_threshold = 5  # require N frames to be "off"
        self._gaze_vote_buffer = deque(maxlen=self._gaze_vote_window)

    @staticmethod
    def _get_camera_names_windows() -> list:
        """Use PowerShell + WMI to get real camera device names on Windows."""
        import subprocess
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Get-CimInstance Win32_PnPEntity | "
                 "Where-Object { $_.PNPClass -eq 'Camera' -or $_.PNPClass -eq 'Image' } | "
                 "Select-Object -ExpandProperty Name"],
                capture_output=True, text=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if result.returncode == 0:
                names = [n.strip() for n in result.stdout.strip().split('\n') if n.strip()]
                return names
        except Exception as e:
            print(f"[list_cameras] WMI query failed: {e}")
        return []

    @staticmethod
    def list_cameras(max_index: int = 5) -> list:
        """Probe camera indices 0..max_index-1 and return available cameras.
        Uses DirectShow (CAP_DSHOW) on Windows for near-instant probing.
        Resolves real device names via WMI on Windows."""
        import platform
        is_windows = platform.system() == "Windows"
        backend = cv2.CAP_DSHOW if is_windows else cv2.CAP_ANY

        # Get real device names from WMI (ordered as Windows enumerates them)
        device_names = FocusTracker._get_camera_names_windows() if is_windows else []

        available = []
        for idx in range(max_index):
            cap = cv2.VideoCapture(idx, backend)
            if cap.isOpened():
                # Map by position: WMI order generally matches DirectShow index
                name = device_names[idx] if idx < len(device_names) else f"Cámara {idx}"
                available.append({
                    "index": idx,
                    "name": name,
                })
                cap.release()
        return available

    def change_camera(self, new_index: int):
        """Hot-swap the camera index. Restarts the tracking loop thread."""
        if new_index == self.camera_index:
            return
        was_running = self.is_running
        if was_running:
            self.is_running = False
            if self._thread:
                self._thread.join(timeout=3)
        self.camera_index = new_index
        if was_running:
            self.is_running = True
            self._thread = threading.Thread(target=self._tracking_loop, daemon=True)
            self._thread.start()

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._score = 100.0
        self._current_focus_streak = 0.0

        # Reiniciar contadores de tiempo
        now = time.time()
        self._last_score_update_time = now
        self._last_stats_update_time = now
        self._candidate_since = now

        # Reset calibration for new session
        self.calibration_phase = CalibrationPhase.WAITING_TO_START
        self._calib_samples_center_gaze.clear()
        self._calib_samples_center_head.clear()
        self._calib_samples_center_blink.clear()
        self._calib_samples_center_face_ratio.clear()
        self._face_ratio_baseline = 0.0
        self._drift_warning_since = None
        for buf in self._calib_samples_corners.values():
            buf.clear()
        self._gaze_h_history.clear()
        self._gaze_v_history.clear()
        self._gaze_vote_buffer.clear()

        # Reset per-bucket session time
        self._segment_seconds = {"working": 0.0, "away": 0.0, "social": 0.0, "absent": 0.0}
        self._active_window_category = None

        self._thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self._thread.start()

    def reset_session(self):
        """Reset session-scoped state (buckets, score, calibration) without
        stopping the camera/thread. Used by the frontend to start a new
        session while keeping the tracker alive."""
        with self._state_lock:
            now = time.time()
            self._segment_seconds = {"working": 0.0, "away": 0.0, "social": 0.0, "absent": 0.0}
            self._score = 100.0
            self._current_focus_streak = 0.0
            self._longest_focus_streak = 0.0
            self._total_focused_time = 0.0
            self._total_distracted_time = 0.0
            self._total_absent_time = 0.0
            self._distraction_events = []
            self._last_score_update_time = now
            self._last_stats_update_time = now
            self._candidate_since = now
            self.calibration_phase = CalibrationPhase.WAITING_TO_START
            self._calib_samples_center_gaze.clear()
            self._calib_samples_center_head.clear()
            self._calib_samples_center_blink.clear()
            self._calib_samples_center_face_ratio.clear()
            self._face_ratio_baseline = 0.0
            self._drift_warning_since = None
            for buf in self._calib_samples_corners.values():
                buf.clear()
            self._gaze_h_history.clear()
            self._gaze_v_history.clear()
            self._gaze_vote_buffer.clear()

    def set_active_window_category(self, category: Optional[str]):
        """Called from window_monitor; thread-safe."""
        with self._state_lock:
            self._active_window_category = category

    def start_calibration(self):
        """Manually trigger the calibration process."""
        if self.calibration_phase == CalibrationPhase.WAITING_TO_START:
            self.calibration_phase = CalibrationPhase.CENTER

    @property
    def is_fully_calibrated(self) -> bool:
        return self.calibration_phase == CalibrationPhase.CALIBRATED

    @property
    def calibration_progress(self) -> float:
        """Returns calibration progress from 0.0 to 1.0."""
        if self.calibration_phase == CalibrationPhase.WAITING_TO_START:
            return 0.0
        if self.calibration_phase == CalibrationPhase.CALIBRATED:
            return 1.0
        if self.calibration_phase == CalibrationPhase.CENTER:
            return (len(self._calib_samples_center_gaze) / self._calib_frames_center) * 0.2
        if self.calibration_phase in CORNER_PHASES:
            idx = CORNER_PHASES.index(self.calibration_phase)
            in_phase = len(self._calib_samples_corners[self.calibration_phase]) / self._calib_frames_corner
            return 0.2 + (idx + min(in_phase, 1.0)) * 0.2
        return 0.0

    @property
    def environment_status(self) -> Dict:
        """Lighting / face distance hints. Useful while WAITING_TO_START."""
        return dict(self._environment_status)

    @property
    def recalibration_suggested(self) -> bool:
        """True if posture drift has persisted long enough to recommend recalibrating."""
        if self._drift_warning_since is None:
            return False
        return (time.time() - self._drift_warning_since) >= self._drift_persist_threshold

    def request_recalibration(self):
        """Reset to WAITING_TO_START so the user can adopt their (new) natural posture."""
        self.calibration_phase = CalibrationPhase.WAITING_TO_START
        self._calib_samples_center_gaze.clear()
        self._calib_samples_center_head.clear()
        self._calib_samples_center_blink.clear()
        self._calib_samples_center_face_ratio.clear()
        for buf in self._calib_samples_corners.values():
            buf.clear()
        self._face_ratio_baseline = 0.0
        self._drift_warning_since = None
        self._gaze_h_history.clear()
        self._gaze_v_history.clear()
        self._gaze_vote_buffer.clear()

    def stop(self):
        self.is_running = False
        if self._thread:
            self._thread.join()
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=False)

    def get_current_state(self) -> FocusState:
        with self._state_lock:
            return self._current_state

    def get_debug_frame(self):
        with self._state_lock:
            if self._last_frame is not None:
                return self._last_frame.copy()
            return None

    def get_frame_and_state(self):
        """Return frame and state atomically to prevent desync flicker."""
        with self._state_lock:
            frame = self._last_frame.copy() if self._last_frame is not None else None
            state = self._current_state
        return frame, state

    def end_session(self) -> Dict:
        self.stop()
        return self.get_session_stats()

    def get_session_stats(self) -> Dict:
        """Snapshot of session stats without stopping the tracker."""
        with self._state_lock:
            return {
                "final_score": float(self._score),
                "total_focused_time": int(self._total_focused_time),
                "total_distracted_time": int(self._total_distracted_time),
                "total_absent_time": int(self._total_absent_time),
                "longest_focus_streak": int(self._longest_focus_streak),
                "distraction_events": list(self._distraction_events),
                "segments_seconds": dict(self._segment_seconds),
            }

    def get_segment_seconds(self) -> Dict[str, float]:
        with self._state_lock:
            return dict(self._segment_seconds)

    def get_live_state(self) -> Dict:
        """Serializable snapshot consumed by the React frontend (~3 Hz polling)."""
        with self._state_lock:
            cs = self._current_state
            seg = dict(self._segment_seconds)
            cat = self._active_window_category
            confirmed = self._current_confirmed_state
            score = float(self._score)
            reason = cs.distraction_reason

        if confirmed == ConcentrationState.NOT_PRESENT:
            bc_state = "absent"
        elif confirmed == ConcentrationState.DISTRACTED:
            bc_state = "away"
        elif cat == "Social Media":
            bc_state = "social"
        else:
            bc_state = "working"

        return {
            "bc_state": bc_state,
            "raw_state": confirmed.value,
            "distraction_reason": reason,
            "score": score,
            "calibration": {
                "phase": self.calibration_phase.name,
                "progress": float(self.calibration_progress),
                "is_calibrated": bool(self.is_fully_calibrated),
                "recalibration_suggested": bool(self.recalibration_suggested),
            },
            "environment": self.environment_status,
            "segments_seconds": seg,
            "active_window_category": cat,
        }

    def _tracking_loop(self):
        cap = cv2.VideoCapture(self.camera_index)
        
        while self.is_running and cap.isOpened():
            success, image = cap.read()
            if not success:
                self._update_candidate(ConcentrationState.NOT_PRESENT, "camera_error", {}, None)
                time.sleep(0.1)
                continue

            img_h, img_w, _ = image.shape
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            
            # --- PARALLEL RECOGNITION ---
            # Run both heavy ML models in parallel to prevent frame rate drops (race condition fix)
            future_face = self._executor.submit(self.detector.detect, mp_image)
            future_gesture = self._executor.submit(self.gesture_recognizer.recognize, mp_image)
            
            detection_result = future_face.result()
            gesture_result = future_gesture.result()
            
            # --- GESTURE PROCESSING ---
            current_time = time.time()
            self._process_gestures(gesture_result, current_time)
            
            raw_data = {"yaw": 0, "pitch": 0, "roll": 0, "ear": 0, "gaze": "center"}
            if self._detected_gestures:
                raw_data["gestures"] = list(self._detected_gestures)
                # Optionally print them for debug or pass to UI
                for g in self._detected_gestures:
                    print(f"[GESTURE DETECTED] {g}")
                self._detected_gestures.clear()
            
            # PASO 1 - Rostro detectado
            if not detection_result.face_landmarks:
                self._update_candidate(ConcentrationState.NOT_PRESENT, "no_face_detected", raw_data, image)
                continue
                
            face_landmarks = detection_result.face_landmarks[0]
            
            # Parse all blendshapes into a dict for easy access
            blendshape_dict = {}
            is_eyes_closed = False
            blink_score = 0.0
            eyes_currently_closed_raw = False
            if detection_result.face_blendshapes:
                blendshapes = detection_result.face_blendshapes[0]
                blendshape_dict = {x.category_name: x.score for x in blendshapes}
                blink_l = blendshape_dict.get("eyeBlinkLeft", 0)
                blink_r = blendshape_dict.get("eyeBlinkRight", 0)
                blink_score = max(blink_l, blink_r)
                
                eyes_currently_closed_raw = blink_l > self._blink_threshold and blink_r > self._blink_threshold
                
                # Blink duration filter: only mark eyes_closed if closed > 0.5s
                if eyes_currently_closed_raw:
                    if self._eyes_closed_since is None:
                        self._eyes_closed_since = time.time()
                    elif time.time() - self._eyes_closed_since > self._blink_min_duration:
                        is_eyes_closed = True
                else:
                    self._eyes_closed_since = None
                    
                raw_data["ear"] = f"{blink_score:.2f} (blink score)"
            
            # Head Pose
            yaw, pitch, roll = 0, 0, 0
            if detection_result.facial_transformation_matrixes:
                matrix = detection_result.facial_transformation_matrixes[0]
                rmat = matrix[:3, :3]
                sy = math.sqrt(rmat[0,0] * rmat[0,0] + rmat[1,0] * rmat[1,0])
                singular = sy < 1e-6
                if not singular:
                    pitch = math.degrees(math.atan2(rmat[2,1] , rmat[2,2]))
                    yaw = math.degrees(math.atan2(-rmat[2,0], sy))
                    roll = math.degrees(math.atan2(rmat[1,0], rmat[0,0]))
                
                # Suavizado menos agresivo para respuesta más rápida
                self._last_yaw = self._last_yaw * 0.4 + yaw * 0.6
                self._last_pitch = self._last_pitch * 0.4 + pitch * 0.6
                yaw, pitch = self._last_yaw, self._last_pitch
                
            raw_data["yaw"] = yaw
            raw_data["pitch"] = pitch
            
            # Exportar coordenadas para overlays (UI / Frontend)
            raw_data["landmarks_2d"] = [(int(lm.x * img_w), int(lm.y * img_h)) for lm in face_landmarks]
            
            # Raw Gaze — using ARKit eyeLook blendshapes
            gaze_h, gaze_v = self._compute_raw_gaze(blendshape_dict)
            
            # --- TEMPORAL SMOOTHING ---
            self._gaze_h_history.append(gaze_h)
            self._gaze_v_history.append(gaze_v)
            smoothed_h = sum(self._gaze_h_history) / len(self._gaze_h_history) if self._gaze_h_history else 0.0
            smoothed_v = sum(self._gaze_v_history) / len(self._gaze_v_history) if self._gaze_v_history else 0.0
            
            raw_data["gaze_x"] = smoothed_h
            raw_data["gaze_y"] = smoothed_v
            
            # Environment hints run every frame: pre-cal uses absolute extremes,
            # post-cal compares against the user's natural-posture baseline.
            self._update_environment_status(image, face_landmarks, img_w, img_h)

            # --- CALIBRATION LOGIC ---
            if self.calibration_phase != CalibrationPhase.CALIBRATED:
                if self.calibration_phase == CalibrationPhase.WAITING_TO_START:
                    # Don't sample anything — wait for user to press Space/Enter
                    raw_data["gaze"] = "center"
                    self._update_candidate(ConcentrationState.FOCUSED, None, raw_data, image)
                    time.sleep(0.03)
                    continue

                if not eyes_currently_closed_raw:
                    if self.calibration_phase == CalibrationPhase.CENTER:
                        self._calib_samples_center_gaze.append((smoothed_h, smoothed_v))
                        self._calib_samples_center_head.append((yaw, pitch))
                        self._calib_samples_center_blink.append(blink_score)
                        self._calib_samples_center_face_ratio.append(self._environment_status["face_ratio"])
                        if len(self._calib_samples_center_gaze) >= self._calib_frames_center:
                            self._compute_center_baselines()
                            self.calibration_phase = CalibrationPhase.TOP_LEFT

                    elif self.calibration_phase in CORNER_PHASES:
                        self._calib_samples_corners[self.calibration_phase].append((smoothed_h, smoothed_v))
                        if len(self._calib_samples_corners[self.calibration_phase]) >= self._calib_frames_corner:
                            self._advance_corner_phase()

                raw_data["gaze"] = "center"
                self._update_candidate(ConcentrationState.FOCUSED, None, raw_data, image)
                time.sleep(0.03)
                continue
            
            # --- POST-CALIBRATION: Deviation from baseline ---
            dev_h = smoothed_h - self._gaze_baseline_h
            dev_v = smoothed_v - self._gaze_baseline_v
            
            # Determine per-frame gaze status (asymmetric thresholds per direction)
            is_off = False
            if dev_h > self._gaze_threshold_right:
                frame_status = "gaze_off_screen_right"
                is_off = True
            elif dev_h < -self._gaze_threshold_left:
                frame_status = "gaze_off_screen_left"
                is_off = True
            elif dev_v < -self._gaze_threshold_up:
                frame_status = "gaze_off_screen_up"
                is_off = True
            elif dev_v > self._gaze_threshold_down:
                frame_status = "gaze_off_screen_down"
                is_off = True
            else:
                frame_status = "center"
            
            # Voting system
            self._gaze_vote_buffer.append(is_off)
            off_count = sum(self._gaze_vote_buffer)
            gaze_status = frame_status if off_count >= self._gaze_vote_threshold else "center"
            raw_data["gaze"] = gaze_status
            
            # PASO 2 - Reglas del estado (jerarquía de prioridad)
            candidate = ConcentrationState.FOCUSED
            reason = None
            
            # Use calibrated head pose baselines
            rel_yaw = abs(yaw - self._head_baseline_yaw)
            rel_pitch_raw = pitch - self._head_baseline_pitch
            
            if is_eyes_closed:
                candidate = ConcentrationState.DISTRACTED
                reason = "eyes_closed"
            elif rel_yaw > self._head_yaw_threshold:
                candidate = ConcentrationState.DISTRACTED
                reason = "head_turned_side"
            elif rel_pitch_raw < -self._head_pitch_up_threshold:
                candidate = ConcentrationState.DISTRACTED
                reason = "head_turned_up"
            elif rel_pitch_raw > self._head_pitch_down_threshold:
                if self.mode == OperationMode.DIGITAL:
                    candidate = ConcentrationState.DISTRACTED
                    reason = "head_turned_down"
                elif self.mode == OperationMode.HYBRID:
                    candidate = ConcentrationState.FOCUSED
                    reason = None
            elif gaze_status != "center":
                candidate = ConcentrationState.DISTRACTED
                reason = "gaze_off_screen"
                
            self._update_candidate(candidate, reason, raw_data, image)
            time.sleep(0.03)
            
        cap.release()

    def _process_gestures(self, result, current_time):
        num_hands = len(result.hand_landmarks) if result.hand_landmarks else 0
        hands_data = []

        if num_hands > 0:
            for i, (gestures_list, landmarks) in enumerate(zip(result.gestures, result.hand_landmarks)):
                top_gesture = max(gestures_list, key=lambda g: g.score).category_name if gestures_list else "None"
                
                cx = sum([lm.x for lm in landmarks]) / len(landmarks)
                cy = sum([lm.y for lm in landmarks]) / len(landmarks)
                hands_data.append({"id": i, "gesture": top_gesture, "cx": cx, "cy": cy})
                
                # Check open palm to fist transition
                last_g, last_g_time = self._last_gesture_by_hand.get(i, (None, 0))
                if top_gesture == "Closed_Fist" and last_g == "Open_Palm":
                    if current_time - last_g_time < 1.0: # transition within 1 second
                        self._detected_gestures.add("PALMA_A_PUNO")
                
                if top_gesture != "None":
                    self._last_gesture_by_hand[i] = (top_gesture, current_time)

        # Clap detection (Una palmada) - Simplified Logic
        if not hasattr(self, '_hands_are_close'):
            self._hands_are_close = False
            self._last_clap_time = 0.0

        current_dist = 1.0
        if num_hands == 2:
            dx = hands_data[0]["cx"] - hands_data[1]["cx"]
            dy = hands_data[0]["cy"] - hands_data[1]["cy"]
            current_dist = math.sqrt(dx*dx + dy*dy)

            if current_dist < 0.15:
                if not self._hands_are_close:
                    self._hands_are_close = True
                    self._register_clap(current_time)
            elif current_dist > 0.20:
                self._hands_are_close = False
                
            self._last_hands_dist = current_dist
        elif num_hands < 2:
            # MediaPipe often loses one hand right at the impact of a clap because they overlap
            if getattr(self, '_last_hands_dist', 1.0) < 0.25:
                if not getattr(self, '_hands_are_close', False):
                    self._hands_are_close = True
                    self._register_clap(current_time)
            
            # Reset states if no hands are visible so it doesn't get stuck
            if num_hands == 0:
                self._hands_are_close = False
                self._last_hands_dist = 1.0

    def _register_clap(self, current_time):
        # Debounce: ignore claps that happen within 1.0s of each other to avoid spamming
        if current_time - self._last_clap_time > 1.0:
            self._detected_gestures.add("UNA_PALMADA")
            self._last_clap_time = current_time

    def _compute_raw_gaze(self, blendshape_dict: Dict):
        if not blendshape_dict:
            return 0.0, 0.0
        
        look_left = (blendshape_dict.get("eyeLookOutLeft", 0) + blendshape_dict.get("eyeLookInRight", 0)) / 2.0
        look_right = (blendshape_dict.get("eyeLookOutRight", 0) + blendshape_dict.get("eyeLookInLeft", 0)) / 2.0
        look_up = (blendshape_dict.get("eyeLookUpLeft", 0) + blendshape_dict.get("eyeLookUpRight", 0)) / 2.0
        look_down = (blendshape_dict.get("eyeLookDownLeft", 0) + blendshape_dict.get("eyeLookDownRight", 0)) / 2.0
        
        gaze_h = look_right - look_left
        gaze_v = look_down - look_up
        return gaze_h, gaze_v

    def _compute_center_baselines(self):
        """After CENTER phase: gaze/head baselines + per-user blink threshold."""
        h_clean = self._reject_outliers_iqr([s[0] for s in self._calib_samples_center_gaze])
        v_clean = self._reject_outliers_iqr([s[1] for s in self._calib_samples_center_gaze])
        yaw_clean = self._reject_outliers_iqr([s[0] for s in self._calib_samples_center_head])
        pitch_clean = self._reject_outliers_iqr([s[1] for s in self._calib_samples_center_head])

        self._gaze_baseline_h = float(np.median(h_clean)) if h_clean else 0.0
        self._gaze_baseline_v = float(np.median(v_clean)) if v_clean else 0.0
        self._head_baseline_yaw = float(np.median(yaw_clean)) if yaw_clean else 0.0
        self._head_baseline_pitch = float(np.median(pitch_clean)) if pitch_clean else 0.0

        # Blink threshold: capture the user's natural eyes-open blink_score ceiling
        # so heavier eyelids don't trigger eyes_closed false positives.
        blink_clean = self._reject_outliers_iqr(self._calib_samples_center_blink)
        if blink_clean:
            p95_open = float(np.percentile(blink_clean, 95))
            self._blink_threshold = max(0.5, min(0.85, p95_open + 0.15))

        # Posture baseline: face width / frame width in the user's natural working pose.
        # Future drift warnings are relative to this, not to a hardcoded "standard distance".
        face_ratio_clean = self._reject_outliers_iqr(self._calib_samples_center_face_ratio)
        self._face_ratio_baseline = float(np.median(face_ratio_clean)) if face_ratio_clean else 0.0

        print(f"[CALIB] Gaze baseline: H={self._gaze_baseline_h:+.3f} V={self._gaze_baseline_v:+.3f}")
        print(f"[CALIB] Head baseline: Yaw={self._head_baseline_yaw:+.1f}° Pitch={self._head_baseline_pitch:+.1f}°")
        print(f"[CALIB] Blink threshold: {self._blink_threshold:.3f}")
        print(f"[CALIB] Posture baseline (face ratio): {self._face_ratio_baseline:.3f}")

    def _advance_corner_phase(self):
        """Move to next corner, or finalize if BOTTOM_LEFT just finished."""
        idx = CORNER_PHASES.index(self.calibration_phase)
        if idx + 1 < len(CORNER_PHASES):
            self.calibration_phase = CORNER_PHASES[idx + 1]
        else:
            self._finalize_calibration()
            self.calibration_phase = CalibrationPhase.CALIBRATED

    def _finalize_calibration(self):
        """Compute asymmetric directional thresholds from the 4 corner phases."""
        tl = self._calib_samples_corners[CalibrationPhase.TOP_LEFT]
        tr = self._calib_samples_corners[CalibrationPhase.TOP_RIGHT]
        br = self._calib_samples_corners[CalibrationPhase.BOTTOM_RIGHT]
        bl = self._calib_samples_corners[CalibrationPhase.BOTTOM_LEFT]

        # gaze_h convention: negative = looking left, positive = looking right
        # gaze_v convention: negative = looking up, positive = looking down
        left_devs = self._reject_outliers_iqr([self._gaze_baseline_h - s[0] for s in (tl + bl)])
        right_devs = self._reject_outliers_iqr([s[0] - self._gaze_baseline_h for s in (tr + br)])
        up_devs = self._reject_outliers_iqr([self._gaze_baseline_v - s[1] for s in (tl + tr)])
        down_devs = self._reject_outliers_iqr([s[1] - self._gaze_baseline_v for s in (bl + br)])

        self._gaze_threshold_left = max(self._gaze_min_threshold_h,
                                        float(np.percentile(left_devs, 95))) if left_devs else self._gaze_min_threshold_h
        self._gaze_threshold_right = max(self._gaze_min_threshold_h,
                                         float(np.percentile(right_devs, 95))) if right_devs else self._gaze_min_threshold_h
        self._gaze_threshold_up = max(self._gaze_min_threshold_v,
                                      float(np.percentile(up_devs, 95))) if up_devs else self._gaze_min_threshold_v
        self._gaze_threshold_down = max(self._gaze_min_threshold_v,
                                        float(np.percentile(down_devs, 95))) if down_devs else self._gaze_min_threshold_v

        print(f"[CALIB] Asymmetric thresholds — "
              f"L={self._gaze_threshold_left:.3f} R={self._gaze_threshold_right:.3f} "
              f"U={self._gaze_threshold_up:.3f} D={self._gaze_threshold_down:.3f}")

    def _update_environment_status(self, image, face_landmarks, img_w: int, img_h: int):
        """Lighting / posture hints. Pure data — UI consumes via property.

        Pre-calibration: only flags extreme cases (no rigid "standard distance"),
        so the user can adopt their own working posture before calibration.
        Post-calibration: distance warnings are relative to the user's own
        face_ratio baseline captured during the CENTER phase.
        """
        xs = [lm.x for lm in face_landmarks]
        ys = [lm.y for lm in face_landmarks]
        face_ratio = max(xs) - min(xs)  # face width relative to frame

        x1 = max(0, int(min(xs) * img_w))
        x2 = min(img_w, int(max(xs) * img_w))
        y1 = max(0, int(min(ys) * img_h))
        y2 = min(img_h, int(max(ys) * img_h))

        brightness = 128.0
        if x2 > x1 and y2 > y1:
            face_region = image[y1:y2, x1:x2]
            if face_region.size > 0:
                gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
                brightness = float(np.mean(gray))

        warning = None
        drift_pct = 0.0

        # Lighting check applies always — bad light breaks blendshapes regardless of posture.
        if brightness < 60:
            warning = "too_dark"
        elif self._face_ratio_baseline > 1e-6:
            # Post-calibration: drift relative to the user's own natural posture.
            drift_pct = (face_ratio - self._face_ratio_baseline) / self._face_ratio_baseline
            if drift_pct > self._posture_drift_tolerance:
                warning = "moved_closer"
            elif drift_pct < -self._posture_drift_tolerance:
                warning = "moved_further"
        else:
            # Pre-calibration: only catch genuinely unworkable extremes.
            if face_ratio < 0.08:
                warning = "barely_visible"

        # Track sustained drift (post-cal only) to suggest recalibration after N seconds.
        is_drifting = (
            self._face_ratio_baseline > 1e-6
            and abs(drift_pct) > self._posture_drift_tolerance
        )
        if is_drifting:
            if self._drift_warning_since is None:
                self._drift_warning_since = time.time()
        else:
            self._drift_warning_since = None

        self._environment_status = {
            "brightness": brightness,
            "face_ratio": face_ratio,
            "drift_pct": drift_pct,
            "warning": warning,
        }

    def _reject_outliers_iqr(self, data: List[float]) -> List[float]:
        """Remove outliers using the IQR method (1.5x IQR rule)."""
        if len(data) < 4:
            return data
        arr = np.array(data)
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        return [x for x in data if lower <= x <= upper]

    def _update_candidate(self, candidate: ConcentrationState, reason: str, raw_data: Dict, frame=None):
        current_time = time.time()
        
        # Actualizar analíticas de tiempo
        delta_t = current_time - self._last_stats_update_time
        self._last_stats_update_time = current_time
        
        # Only accumulate session-scoped buckets after calibration is done,
        # so the Ring starts truly empty when the user begins the Pomodoro.
        accumulate = self.calibration_phase == CalibrationPhase.CALIBRATED

        if self._current_confirmed_state == ConcentrationState.FOCUSED:
            self._total_focused_time += delta_t
            self._current_focus_streak += delta_t
            if self._current_focus_streak > self._longest_focus_streak:
                self._longest_focus_streak = self._current_focus_streak
            if accumulate:
                if self._active_window_category == "Social Media":
                    self._segment_seconds["social"] += delta_t
                else:
                    self._segment_seconds["working"] += delta_t
        else:
            self._current_focus_streak = 0.0
            if self._current_confirmed_state == ConcentrationState.DISTRACTED:
                self._total_distracted_time += delta_t
                if accumulate:
                    self._segment_seconds["away"] += delta_t
            elif self._current_confirmed_state == ConcentrationState.NOT_PRESENT:
                self._total_absent_time += delta_t
                if accumulate:
                    self._segment_seconds["absent"] += delta_t
        
        # Scoring pomodoro manager
        score_delta_t = current_time - self._last_score_update_time
        self._last_score_update_time = current_time
        
        if self._current_confirmed_state == ConcentrationState.FOCUSED:
            speed = 1.5 if self._current_focus_streak > self.focus_bonus_streak else 1.0
            up_rate = (100.0 / self.pomodoro_duration) * speed 
            self._score = min(100.0, self._score + (up_rate * score_delta_t))
        elif self._current_confirmed_state == ConcentrationState.DISTRACTED:
            down_rate = 100.0 / (self.pomodoro_duration / 4) 
            self._score = max(0.0, self._score - (down_rate * score_delta_t))
        
        if candidate != self._candidate_state:
            self._candidate_state = candidate
            self._candidate_reason = reason
            self._candidate_since = current_time
            
        time_in_candidate = current_time - self._candidate_since
        confirm_new_state = False
        
        if candidate == ConcentrationState.NOT_PRESENT:
            confirm_new_state = True
        elif candidate == ConcentrationState.DISTRACTED and time_in_candidate >= self.distraction_grace_period:
            confirm_new_state = True
        elif candidate == ConcentrationState.FOCUSED and time_in_candidate >= 0.3:
            confirm_new_state = True
            
        if confirm_new_state and candidate != self._current_confirmed_state:
            old_state = self._current_confirmed_state
            self._current_confirmed_state = candidate
            confirmed_reason = self._candidate_reason
            
            if candidate == ConcentrationState.DISTRACTED:
                self._distraction_events.append({
                    "timestamp": current_time, 
                    "reason": confirmed_reason
                })
                
            state_obj = FocusState(
                state=self._current_confirmed_state,
                score=self._score,
                distraction_reason=confirmed_reason if candidate != ConcentrationState.FOCUSED else None,
                raw_data=raw_data
            )
            
            if self.on_state_change:
                try:
                    self.on_state_change(old_state, candidate)
                except Exception as e:
                    print(f"Error on_state_change: {e}")
                    
            if candidate == ConcentrationState.DISTRACTED and self.on_distracted:
                try:
                    self.on_distracted(state_obj)
                except Exception as e:
                    print(f"Error on_distracted: {e}")
                    
        # Persist last valid landmarks so the mesh never flickers
        if "landmarks_2d" in raw_data and raw_data["landmarks_2d"]:
            self._last_valid_landmarks = raw_data["landmarks_2d"]
        elif self._last_valid_landmarks:
            raw_data["landmarks_2d"] = self._last_valid_landmarks

        with self._state_lock:
            # Store frame + state atomically so demo always gets a matched pair
            if frame is not None:
                self._last_frame = frame.copy()
            self._current_state = FocusState(
                state=self._current_confirmed_state,
                score=self._score,
                distraction_reason=self._candidate_reason if self._current_confirmed_state != ConcentrationState.FOCUSED else None,
                raw_data=raw_data
            )
