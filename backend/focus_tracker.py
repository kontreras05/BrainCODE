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

# Descarga automática del modelo de MediaPipe
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

def download_model():
    if not os.path.exists(MODEL_PATH):
        print(f"Descargando modelo face_landmarker.task (se hace solo una vez)...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)

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
        
        download_model()
        
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1
        )
        self.detector = vision.FaceLandmarker.create_from_options(options)
        
        self._last_yaw = 0
        self._last_pitch = 0
        self._last_roll = 0
        
        # Blink duration filter (ignore blinks < 0.5s)
        self._eyes_closed_since = None
        self._blink_min_duration = 0.5  # seconds — normal blink is ~200ms
        
        # Gaze calibration using blendshapes
        self._gaze_calibrated = False
        self._gaze_baseline_h = 0.0
        self._gaze_baseline_v = 0.0
        self._gaze_calibration_samples = []
        self._gaze_calibration_frames = 60  # ~2 seconds at 30fps
        self._gaze_threshold_h = 0.15  # horizontal deadzone
        self._gaze_threshold_v = 0.20  # vertical deadzone (more forgiving)

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
        self._gaze_calibrated = False
        self._gaze_calibration_samples = []
        
        self._thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self._thread.start()

    def calibrate_gaze(self, h_ratio: float, v_ratio: float):
        """Manually set the gaze baseline (center position when looking at screen)."""
        self._gaze_baseline_h = h_ratio
        self._gaze_baseline_v = v_ratio
        self._gaze_calibrated = True

    @property
    def is_gaze_calibrated(self) -> bool:
        return self._gaze_calibrated

    def stop(self):
        self.is_running = False
        if self._thread:
            self._thread.join()

    def get_current_state(self) -> FocusState:
        with self._state_lock:
            return self._current_state

    def get_debug_frame(self):
        with self._state_lock:
            if self._last_frame is not None:
                return self._last_frame.copy()
            return None

    def end_session(self) -> Dict:
        self.stop()
        return {
            "final_score": float(self._score),
            "total_focused_time": int(self._total_focused_time),
            "total_distracted_time": int(self._total_distracted_time),
            "total_absent_time": int(self._total_absent_time),
            "longest_focus_streak": int(self._longest_focus_streak),
            "distraction_events": self._distraction_events
        }

    def _tracking_loop(self):
        cap = cv2.VideoCapture(self.camera_index)
        
        while self.is_running and cap.isOpened():
            success, image = cap.read()
            if not success:
                self._update_candidate(ConcentrationState.NOT_PRESENT, "camera_error", {})
                time.sleep(0.1)
                continue
                
            with self._state_lock:
                self._last_frame = image.copy()

            img_h, img_w, _ = image.shape
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            detection_result = self.detector.detect(mp_image)
            
            raw_data = {"yaw": 0, "pitch": 0, "roll": 0, "ear": 0, "gaze": "center"}
            
            # PASO 1 - Rostro detectado
            if not detection_result.face_landmarks:
                self._update_candidate(ConcentrationState.NOT_PRESENT, "no_face_detected", raw_data)
                continue
                
            face_landmarks = detection_result.face_landmarks[0]
            
            # Parse all blendshapes into a dict for easy access
            blendshape_dict = {}
            is_eyes_closed = False
            blink_score = 0.0
            if detection_result.face_blendshapes:
                blendshapes = detection_result.face_blendshapes[0]
                blendshape_dict = {x.category_name: x.score for x in blendshapes}
                blink_l = blendshape_dict.get("eyeBlinkLeft", 0)
                blink_r = blendshape_dict.get("eyeBlinkRight", 0)
                blink_score = max(blink_l, blink_r)
                
                # Blink duration filter: only mark eyes_closed if closed > 0.5s
                if blink_l > 0.5 and blink_r > 0.5:
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
            
            # Gaze — using ARKit eyeLook blendshapes (much more precise than iris landmarks)
            gaze_status, gaze_h, gaze_v = self._estimate_gaze(blendshape_dict)
            raw_data["gaze"] = gaze_status
            raw_data["gaze_x"] = gaze_h
            raw_data["gaze_y"] = gaze_v
            
            # PASO 2 - Reglas del estado (jerarquía de prioridad)
            candidate = ConcentrationState.FOCUSED
            reason = None
            
            if is_eyes_closed:
                candidate = ConcentrationState.DISTRACTED
                reason = "eyes_closed"
            elif abs(yaw) > 25:
                candidate = ConcentrationState.DISTRACTED
                reason = "head_turned_side"
            elif pitch < -20:
                candidate = ConcentrationState.DISTRACTED
                reason = "head_turned_up"
            elif pitch > 35:
                if self.mode == OperationMode.DIGITAL:
                    candidate = ConcentrationState.DISTRACTED
                    reason = "head_turned_down"
                elif self.mode == OperationMode.HYBRID:
                    candidate = ConcentrationState.FOCUSED
                    reason = None
            elif gaze_status != "center":
                candidate = ConcentrationState.DISTRACTED
                reason = "gaze_off_screen"
                
            self._update_candidate(candidate, reason, raw_data)
            time.sleep(0.03)
            
        cap.release()

    def _update_candidate(self, candidate: ConcentrationState, reason: str, raw_data: Dict):
        current_time = time.time()
        
        # Actualizar analíticas de tiempo
        delta_t = current_time - self._last_stats_update_time
        self._last_stats_update_time = current_time
        
        if self._current_confirmed_state == ConcentrationState.FOCUSED:
            self._total_focused_time += delta_t
            self._current_focus_streak += delta_t
            if self._current_focus_streak > self._longest_focus_streak:
                self._longest_focus_streak = self._current_focus_streak
        else:
            self._current_focus_streak = 0.0
            if self._current_confirmed_state == ConcentrationState.DISTRACTED:
                self._total_distracted_time += delta_t
            elif self._current_confirmed_state == ConcentrationState.NOT_PRESENT:
                self._total_absent_time += delta_t
        
        # Scoring pomodoro manager
        score_delta_t = current_time - self._last_score_update_time
        self._last_score_update_time = current_time
        
        if self._current_confirmed_state == ConcentrationState.FOCUSED:
            speed = 1.5 if self._current_focus_streak > self.focus_bonus_streak else 1.0
            up_rate = (100.0 / self.pomodoro_duration) * speed 
            self._score = min(100.0, self._score + (up_rate * score_delta_t))
        elif self._current_confirmed_state == ConcentrationState.DISTRACTED:
            # Penaliza restando todo el score relativo a un 100% en 1/4 del tiempo de pomodoro
            down_rate = 100.0 / (self.pomodoro_duration / 4) 
            self._score = max(0.0, self._score - (down_rate * score_delta_t))
        # NOT_PRESENT congela el score
        
        # Lógica de cambio de candidato
        if candidate != self._candidate_state:
            self._candidate_state = candidate
            self._candidate_reason = reason
            self._candidate_since = current_time
            
        # Validar tiempos (Grace periods)
        time_in_candidate = current_time - self._candidate_since
        confirm_new_state = False
        
        if candidate == ConcentrationState.NOT_PRESENT:
            confirm_new_state = True
        elif candidate == ConcentrationState.DISTRACTED and time_in_candidate >= self.distraction_grace_period:
            confirm_new_state = True
        elif candidate == ConcentrationState.FOCUSED and time_in_candidate >= 0.3:
            confirm_new_state = True
            
        # Si se confirma un cambio frente al estado real:
        if confirm_new_state and candidate != self._current_confirmed_state:
            old_state = self._current_confirmed_state
            self._current_confirmed_state = candidate
            confirmed_reason = self._candidate_reason
            
            # Guardamos el evento si es distracción
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
                    
        # Actualizar exposición pública de datos en cada frame
        with self._state_lock:
            self._current_state = FocusState(
                state=self._current_confirmed_state,
                score=self._score,
                distraction_reason=self._candidate_reason if self._current_confirmed_state != ConcentrationState.FOCUSED else None,
                raw_data=raw_data
            )

    def _estimate_gaze(self, blendshape_dict: Dict):
        """Estimate gaze direction using ARKit eyeLook blendshapes.
        
        These are specifically designed by Apple for gaze tracking and are
        far more accurate than trying to compute iris position from landmarks.
        
        Blendshapes used:
          - eyeLookOutLeft/Right: eye looking away from nose (outward)
          - eyeLookInLeft/Right: eye looking towards nose (inward)
          - eyeLookUpLeft/Right: eye looking up
          - eyeLookDownLeft/Right: eye looking down
        """
        if not blendshape_dict:
            return "center", 0.0, 0.0
        
        # When looking LEFT: left eye looks OUT, right eye looks IN
        look_left = (
            blendshape_dict.get("eyeLookOutLeft", 0) + 
            blendshape_dict.get("eyeLookInRight", 0)
        ) / 2.0
        
        # When looking RIGHT: right eye looks OUT, left eye looks IN
        look_right = (
            blendshape_dict.get("eyeLookOutRight", 0) + 
            blendshape_dict.get("eyeLookInLeft", 0)
        ) / 2.0
        
        # Vertical gaze (averaged from both eyes)
        look_up = (
            blendshape_dict.get("eyeLookUpLeft", 0) + 
            blendshape_dict.get("eyeLookUpRight", 0)
        ) / 2.0
        
        look_down = (
            blendshape_dict.get("eyeLookDownLeft", 0) + 
            blendshape_dict.get("eyeLookDownRight", 0)
        ) / 2.0
        
        # Composite gaze axes: positive = right/down, negative = left/up
        gaze_h = look_right - look_left
        gaze_v = look_down - look_up
        
        # Auto-calibration: learn the user's "looking at screen" baseline
        if not self._gaze_calibrated:
            self._gaze_calibration_samples.append((gaze_h, gaze_v))
            if len(self._gaze_calibration_samples) >= self._gaze_calibration_frames:
                h_samples = [s[0] for s in self._gaze_calibration_samples]
                v_samples = [s[1] for s in self._gaze_calibration_samples]
                self._gaze_baseline_h = sorted(h_samples)[len(h_samples)//2]
                self._gaze_baseline_v = sorted(v_samples)[len(v_samples)//2]
                self._gaze_calibrated = True
                print(f"[CALIBRACIÓN] Gaze baseline: H={self._gaze_baseline_h:+.3f}, V={self._gaze_baseline_v:+.3f}")
            return "center", gaze_h, gaze_v
        
        # Deviation from calibrated center
        dev_h = gaze_h - self._gaze_baseline_h
        dev_v = gaze_v - self._gaze_baseline_v
        
        # Check against thresholds
        if dev_h > self._gaze_threshold_h:
            status = "gaze_off_screen_right"
        elif dev_h < -self._gaze_threshold_h:
            status = "gaze_off_screen_left" 
        elif dev_v < -self._gaze_threshold_v:
            status = "gaze_off_screen_up"
        elif dev_v > self._gaze_threshold_v:
            status = "gaze_off_screen_down"
        else:
            status = "center"
            
        return status, dev_h, dev_v
