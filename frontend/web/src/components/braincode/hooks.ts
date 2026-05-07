import { useCallback, useEffect, useRef, useState } from "react";
import type { BCState, SessionConfig, SessionRecord } from "./state";
import { mockApi } from "./mock-api";

export function pyApi(): any {
  // @ts-ignore
  return (typeof window !== 'undefined' && window.pywebview && window.pywebview.api) || null;
}

// En `npm run dev` no hay backend Python; el mock sirve para iterar la UI
// (selector de cámara, calibración fullscreen, transiciones de estado).
function isDev(): boolean {
  // @ts-ignore - Vite import.meta.env
  return typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
}

export function waitForPyApi(timeoutMs = 1500): Promise<any> {
  return new Promise(resolve => {
    if (pyApi()) return resolve(pyApi());
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (pyApi()) { clearInterval(iv); resolve(pyApi()); }
      else if (Date.now() - t0 > timeoutMs) {
        clearInterval(iv);
        if (isDev()) {
          // eslint-disable-next-line no-console
          console.info("[BrainCODE] usando mock-api (dev sin pywebview)");
          resolve(mockApi);
        } else {
          resolve(null);
        }
      }
    }, 100);
  });
}

export function useBackendData() {
  const [metrics, setMetrics] = useState<any>(null);
  const [hourly, setHourly] = useState<any[]>([]);
  const [score, setScore] = useState({ pct: 0, mins: 0 });

  useEffect(() => {
    let alive = true;
    async function load() {
      const api = await waitForPyApi();
      if (!api || !alive) return;
      try {
        const today = await api.get_today_metrics();
        if (alive && today && today.has_data) {
          setMetrics(today);
          setScore({ pct: today.score_pct, mins: today.active_minutes });
        }
        const hb = await api.get_hourly_breakdown();
        if (alive && hb && hb.length) {
          setHourly(hb);
        }
      } catch (err) {
        console.warn('API error', err);
      }
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return { metrics, hourly, score };
}

// ── Live FocusTracker ───────────────────────────────────────────

export type CalibrationPhaseName =
  | "WAITING_TO_START"
  | "CENTER"
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_RIGHT"
  | "BOTTOM_LEFT"
  | "CALIBRATED";

export interface LiveCalibration {
  phase: CalibrationPhaseName;
  progress: number;
  is_calibrated: boolean;
  recalibration_suggested: boolean;
}

export interface LiveEnvironment {
  brightness: number;
  face_ratio: number;
  drift_pct: number;
  warning: string | null;
}

export interface LiveState {
  bc_state: BCState;
  raw_state: string;
  distraction_reason: string | null;
  score: number;
  calibration: LiveCalibration;
  environment: LiveEnvironment;
  segments_seconds: { working: number; away: number; social: number; absent: number };
  active_window_category: string | null;
}

export type NormalizationMode =
  | { kind: "fixed"; durationSec: number }
  | { kind: "elapsed" };

const DEFAULT_LIVE: LiveState = {
  bc_state: "working",
  raw_state: "FOCUSED",
  distraction_reason: null,
  score: 100,
  calibration: { phase: "WAITING_TO_START", progress: 0, is_calibrated: false, recalibration_suggested: false },
  environment: { brightness: 0, face_ratio: 0, drift_pct: 0, warning: null },
  segments_seconds: { working: 0, away: 0, social: 0, absent: 0 },
  active_window_category: null,
};

export function useLiveState(active: boolean, intervalMs = 300) {
  const [live, setLive] = useState<LiveState | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer: any = null;

    async function tick() {
      const api = await waitForPyApi();
      if (!alive || !api) return;
      try {
        const s = await api.get_live_state();
        if (alive && s) setLive(s as LiveState);
      } catch (err) {
        // swallow — backend may be transiently unavailable
      }
    }

    tick();
    timer = setInterval(tick, intervalMs);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [active, intervalMs]);

  return live;
}

export function useFocusTracker(
  sessionActive: boolean,
  isPaused: boolean,
  normMode: NormalizationMode,
  resetKey?: string
) {
  const live = useLiveState(sessionActive);
  const lastEmittedState = useRef<BCState | null>(null);

  const [baseSegs, setBaseSegs] = useState({ working: 0, away: 0, social: 0, absent: 0 });
  const [pauseOffset, setPauseOffset] = useState({ working: 0, away: 0, social: 0, absent: 0 });
  const resetKeyRef = useRef(resetKey);
  const lastLiveRef = useRef<LiveState | null>(null);

  useEffect(() => {
    if (live && isPaused && lastLiveRef.current) {
      const prev = lastLiveRef.current.segments_seconds;
      const curr = live.segments_seconds;
      setPauseOffset((po) => ({
        working: po.working + Math.max(0, curr.working - prev.working),
        away: po.away + Math.max(0, curr.away - prev.away),
        social: po.social + Math.max(0, curr.social - prev.social),
        absent: po.absent + Math.max(0, curr.absent - prev.absent),
      }));
    }
    lastLiveRef.current = live;
  }, [live, isPaused]);

  useEffect(() => {
    if (live && resetKey !== resetKeyRef.current) {
      setBaseSegs(live.segments_seconds);
      setPauseOffset({ working: 0, away: 0, social: 0, absent: 0 });
      resetKeyRef.current = resetKey;
    }
  }, [live, resetKey]);

  useEffect(() => {
    if (!live) return;
    if (lastEmittedState.current !== live.bc_state) {
      lastEmittedState.current = live.bc_state;
      window.dispatchEvent(new CustomEvent("bc-state", { detail: live.bc_state }));
    }
  }, [live?.bc_state]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = live ?? DEFAULT_LIVE;
  const rawSeg = data.segments_seconds;

  // Subtract base segments and accumulated pause offset
  const seg = resetKey !== undefined ? {
    working: Math.max(0, rawSeg.working - baseSegs.working - pauseOffset.working),
    away: Math.max(0, rawSeg.away - baseSegs.away - pauseOffset.away),
    social: Math.max(0, rawSeg.social - baseSegs.social - pauseOffset.social),
    absent: Math.max(0, rawSeg.absent - baseSegs.absent - pauseOffset.absent),
  } : rawSeg;

  let segs: { working: number; away: number; social: number; absent: number };
  if (normMode.kind === "fixed") {
    const d = Math.max(1, normMode.durationSec);
    segs = {
      working: Math.min(1, seg.working / d),
      away: Math.min(1, seg.away / d),
      social: Math.min(1, seg.social / d),
      absent: Math.min(1, seg.absent / d),
    };
  } else {
    const total = Math.max(1, seg.working + seg.away + seg.social + seg.absent);
    segs = {
      working: seg.working / total,
      away: seg.away / total,
      social: seg.social / total,
      absent: seg.absent / total,
    };
  }

  return {
    state: data.bc_state,
    segs,
    segSecs: seg,
    calibration: data.calibration,
    environment: data.environment,
    score: data.score,
    distractionReason: data.distraction_reason,
    raw: live,
  };
}

export function useFocusControl() {
  const startSession = useCallback(async (cameraIndex?: number) => {
    const api = await waitForPyApi();
    if (!api) return null;
    try { return await api.start_session(cameraIndex); } catch { return null; }
  }, []);

  const stopSession = useCallback(async () => {
    const api = await waitForPyApi();
    if (!api) return null;
    try { return await api.stop_session(); } catch { return null; }
  }, []);

  const startCalibration = useCallback(async () => {
    const api = await waitForPyApi();
    if (!api) return null;
    try { return await api.start_calibration(); } catch { return null; }
  }, []);

  const requestRecalibration = useCallback(async () => {
    const api = await waitForPyApi();
    if (!api) return null;
    try { return await api.request_recalibration(); } catch { return null; }
  }, []);

  return { startSession, stopSession, startCalibration, requestRecalibration };
}

// ── Sessions ────────────────────────────────────────────────────

export function useSessions() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      const api = await waitForPyApi();
      if (!api || !alive) return;
      try {
        const rows = await api.list_sessions();
        if (alive && Array.isArray(rows)) setSessions(rows);
      } catch (err) {
        console.warn("[useSessions] error", err);
      }
    }

    load();

    function onVisibility() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return sessions;
}

// ── Pomodoro (unchanged) ────────────────────────────────────────

export function usePomodoro() {
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [secs, setSecs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(0);
  const [completed, setCompleted] = useState(false);
  const doneRef = useRef(0);

  function start(cfg: SessionConfig) {
    setConfig(cfg);
    setIsBreak(false);
    setDone(0);
    doneRef.current = 0;
    setCompleted(false);
    setElapsed(0);
    setSecs(cfg.mode === "pomodoro" ? cfg.workMin * 60 : 0);
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setConfig(null);
    setIsBreak(false);
    setSecs(0);
    setElapsed(0);
    setDone(0);
    doneRef.current = 0;
    setCompleted(false);
  }

  useEffect(() => {
    if (!running || !config) return;
    if (config.mode === "freeflow") {
      const t = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(t);
    }
    const cfg = config;
    const t = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          setRunning(false);
          if (!isBreak) {
            const nd = doneRef.current + 1;
            doneRef.current = nd;
            setDone(nd);
            if (cfg.totalPoms && nd >= cfg.totalPoms) {
              setCompleted(true);
              return 0;
            }
            setIsBreak(true);
            return cfg.breakMin * 60;
          } else {
            setIsBreak(false);
            return cfg.workMin * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, isBreak, config]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function skip() {
    if (!config || config.mode !== "pomodoro") return;
    setRunning(false);
    if (isBreak) {
      setIsBreak(false);
      setSecs(config.workMin * 60);
    } else {
      const nd = doneRef.current + 1;
      doneRef.current = nd;
      setDone(nd);
      if (config.totalPoms && nd >= config.totalPoms) {
        setCompleted(true);
        return;
      }
      setIsBreak(true);
      setSecs(config.breakMin * 60);
    }
  }

  return { config, running, setRunning, isBreak, secs, elapsed, fmt, done, skip, start, reset, completed };
}
