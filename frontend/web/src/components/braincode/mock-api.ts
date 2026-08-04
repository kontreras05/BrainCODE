// Mock de window.pywebview.api para `npm run dev` (sin Python).
// Solo se activa en modo dev cuando no hay pywebview real disponible.
// Permite iterar sobre la UI (selector de cámara, calibración fullscreen,
// transiciones de estado) sin levantar el backend.

import type { SessionRecord } from "./state";

type CalibPhase =
  | "WAITING_TO_START"
  | "CENTER"
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_RIGHT"
  | "BOTTOM_LEFT"
  | "CALIBRATED";

const PHASE_ORDER: CalibPhase[] = [
  "CENTER",
  "TOP_LEFT",
  "TOP_RIGHT",
  "BOTTOM_RIGHT",
  "BOTTOM_LEFT",
  "CALIBRATED",
];

const FAKE_CAMERAS = [
  { index: 0, name: "Cámara integrada (mock)" },
  { index: 1, name: "Logitech C920 (mock)" },
];

// State machine vivo del mock.
const mock = {
  sessionActive: false,
  cameraIndex: 0,
  calibPhase: "WAITING_TO_START" as CalibPhase,
  phaseStartedAt: 0,
  segments: { working: 0, away: 0, social: 0, absent: 0 },
  bcState: "working" as "working" | "away" | "social" | "absent",
  rawState: "FOCUSED",
  score: 100,
  sessionStartedAt: 0,
};

function tickCalibration() {
  if (mock.calibPhase === "WAITING_TO_START" || mock.calibPhase === "CALIBRATED") return;
  const elapsed = (Date.now() - mock.phaseStartedAt) / 1000;
  // Cada fase dura 2s en el mock para iterar rápido.
  if (elapsed >= 2) {
    const idx = PHASE_ORDER.indexOf(mock.calibPhase);
    const next = PHASE_ORDER[idx + 1] ?? "CALIBRATED";
    mock.calibPhase = next;
    mock.phaseStartedAt = Date.now();
  }
}

function calibProgress(): number {
  if (mock.calibPhase === "WAITING_TO_START") return 0;
  if (mock.calibPhase === "CALIBRATED") return 1;
  const idx = PHASE_ORDER.indexOf(mock.calibPhase);
  const elapsed = Math.min(1, (Date.now() - mock.phaseStartedAt) / 2000);
  return (idx + elapsed) / PHASE_ORDER.length;
}

function tickSegments() {
  if (!mock.sessionActive || mock.calibPhase !== "CALIBRATED") return;
  // 1 segundo de "working" cada vez que la UI haga polling
  mock.segments.working += 0.3;
}

export const mockApi = {
  list_cameras() {
    return Promise.resolve({ cameras: FAKE_CAMERAS, current: mock.cameraIndex });
  },

  start_session(cameraIndex?: number) {
    if (typeof cameraIndex === "number") mock.cameraIndex = cameraIndex;
    mock.sessionActive = true;
    mock.calibPhase = "WAITING_TO_START";
    mock.phaseStartedAt = 0;
    mock.segments = { working: 0, away: 0, social: 0, absent: 0 };
    mock.score = 100;
    mock.sessionStartedAt = Date.now();
    return Promise.resolve({
      ok: true,
      video_url: "",
      camera_index: mock.cameraIndex,
    });
  },

  stop_session() {
    mock.sessionActive = false;
    mock.calibPhase = "WAITING_TO_START";
    return Promise.resolve({
      final_score: mock.score,
      total_focused_time: Math.round(mock.segments.working),
      total_distracted_time: Math.round(mock.segments.away),
      total_absent_time: Math.round(mock.segments.absent),
      longest_focus_streak: Math.round(mock.segments.working),
      distraction_events: [],
      segments_seconds: { ...mock.segments },
    });
  },

  start_calibration() {
    if (mock.calibPhase === "WAITING_TO_START") {
      mock.calibPhase = "CENTER";
      mock.phaseStartedAt = Date.now();
    }
    return Promise.resolve({ ok: true });
  },

  request_recalibration() {
    mock.calibPhase = "WAITING_TO_START";
    return Promise.resolve({ ok: true });
  },

  get_live_state() {
    tickCalibration();
    tickSegments();
    return Promise.resolve({
      bc_state: mock.bcState,
      raw_state: mock.rawState,
      distraction_reason: null,
      score: mock.score,
      calibration: {
        phase: mock.calibPhase,
        progress: calibProgress(),
        is_calibrated: mock.calibPhase === "CALIBRATED",
        recalibration_suggested: false,
      },
      environment: { brightness: 130, face_ratio: 0.3, drift_pct: 0, warning: null },
      segments_seconds: { ...mock.segments },
      active_window_category: null,
    });
  },

  get_today_metrics() {
    return Promise.resolve({
      score_pct: 72,
      active_minutes: 145,
      totals_seconds: { working: 8700, away: 1200, social: 600, absent: 300 },
      raw_by_category: {},
      has_data: true,
    });
  },

  get_hourly_breakdown() {
    return Promise.resolve([]);
  },

  get_video_url() {
    return Promise.resolve("");
  },

  list_sessions(since_iso?: string): Promise<SessionRecord[]> {
    const now = Date.now();
    const day = 86400_000;
    function ts(daysAgo: number, h: number, m: number): string {
      const d = new Date(now - daysAgo * day);
      d.setHours(h, m, 0, 0);
      return d.toISOString().replace("T", " ").slice(0, 19);
    }
    const rows: SessionRecord[] = [
      { id: 1,  started_at: ts(0, 9, 0),  ended_at: ts(0, 9, 25),  duration_sec: 1500, mode: "pomodoro", score: 88, longest_streak_sec: 1100, working_sec: 1200, away_sec: 180, social_sec: 60,  absent_sec: 60 },
      { id: 2,  started_at: ts(0, 10, 0), ended_at: ts(0, 10, 45), duration_sec: 2700, mode: "freeflow", score: 72, longest_streak_sec: 900,  working_sec: 1800, away_sec: 500, social_sec: 200, absent_sec: 200 },
      { id: 3,  started_at: ts(0, 14, 0), ended_at: ts(0, 14, 30), duration_sec: 1800, mode: "pomodoro", score: 95, longest_streak_sec: 1700, working_sec: 1700, away_sec: 50,  social_sec: 30,  absent_sec: 20 },
      { id: 4,  started_at: ts(1, 9, 30), ended_at: ts(1, 10, 15), duration_sec: 2700, mode: "freeflow", score: 60, longest_streak_sec: 700,  working_sec: 1500, away_sec: 700, social_sec: 300, absent_sec: 200 },
      { id: 5,  started_at: ts(1, 11, 0), ended_at: ts(1, 11, 50), duration_sec: 3000, mode: "pomodoro", score: 80, longest_streak_sec: 1400, working_sec: 2200, away_sec: 400, social_sec: 200, absent_sec: 200 },
      { id: 6,  started_at: ts(2, 8, 0),  ended_at: ts(2, 8, 20),  duration_sec: 1200, mode: "freeflow", score: 50, longest_streak_sec: 500,  working_sec: 600,  away_sec: 400, social_sec: 100, absent_sec: 100 },
      { id: 7,  started_at: ts(2, 15, 0), ended_at: ts(2, 16, 30), duration_sec: 5400, mode: "freeflow", score: 78, longest_streak_sec: 2000, working_sec: 3800, away_sec: 800, social_sec: 400, absent_sec: 400 },
      { id: 8,  started_at: ts(4, 10, 0), ended_at: ts(4, 10, 25), duration_sec: 1500, mode: "pomodoro", score: 91, longest_streak_sec: 1300, working_sec: 1350, away_sec: 80,  social_sec: 40,  absent_sec: 30 },
      { id: 9,  started_at: ts(4, 13, 0), ended_at: ts(4, 14, 0),  duration_sec: 3600, mode: "freeflow", score: 65, longest_streak_sec: 1000, working_sec: 2200, away_sec: 800, social_sec: 400, absent_sec: 200 },
      { id: 10, started_at: ts(6, 9, 0),  ended_at: ts(6, 9, 30),  duration_sec: 1800, mode: "pomodoro", score: 85, longest_streak_sec: 1600, working_sec: 1600, away_sec: 100, social_sec: 60,  absent_sec: 40 },
    ];
    const filtered = since_iso
      ? rows.filter((r) => r.started_at >= since_iso)
      : rows;
    return Promise.resolve(filtered);
  },
};

export type MockApi = typeof mockApi;
