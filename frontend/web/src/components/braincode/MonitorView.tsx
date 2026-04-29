import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { BrainMascot } from "./BrainMascot";
import { Ring } from "./Ring";
import { SessionSetup } from "./SessionSetup";
import { Sparkles } from "./Sparkles";
import { CameraModal } from "./CameraModal";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { useFocusControl, useFocusTracker, usePomodoro, type NormalizationMode } from "./hooks";
import { CFG, STATES, type SessionConfig } from "./state";
import { pickInsight } from "./insights";

const VIDEO_URL = "http://127.0.0.1:8765/video_feed";

const ENV_HINT: Record<string, string> = {
  too_dark: "Hay poca luz",
  barely_visible: "Cara apenas detectada",
  moved_closer: "Te has acercado a la cámara",
  moved_further: "Te has alejado de la cámara",
};

type CompletedBeat = "celebrate" | "insight" | "breakdown" | "cta";

interface MonitorViewProps {
  camOn: boolean;
  setCamOn: (v: boolean) => void;
  camOpen: boolean;
  setCamOpen: (v: boolean) => void;
}

function configToNormMode(cfg: SessionConfig | null): NormalizationMode {
  if (cfg && cfg.mode === "pomodoro") {
    return { kind: "fixed", durationSec: cfg.workMin * 60 * cfg.totalPoms };
  }
  return { kind: "elapsed" };
}

export function MonitorView({ camOn, setCamOn, camOpen, setCamOpen }: MonitorViewProps) {
  const [pendingConfig, setPendingConfig] = useState<SessionConfig | null>(null);
  const [focusing, setFocusing] = useState(false);
  const [completedBeat, setCompletedBeat] = useState<CompletedBeat>("celebrate");
  const lastSegsRef = useRef({ working: 0, away: 0, social: 0, absent: 0 });
  const pom = usePomodoro();
  const ctrl = useFocusControl();

  const normMode = useMemo<NormalizationMode>(() => {
    if (pom.config) return configToNormMode(pom.config);
    if (pendingConfig) return configToNormMode(pendingConfig);
    return { kind: "elapsed" };
  }, [pom.config, pendingConfig]);

  const focusActive = pom.running || pendingConfig !== null;
  const { state, segs, calibration, environment } = useFocusTracker(focusActive, normMode);

  // Freeze the last live segments at completion so the ring summary is stable.
  useEffect(() => {
    if (focusActive) lastSegsRef.current = segs;
  }, [focusActive, segs]);
  const displaySegs = pom.completed ? lastSegsRef.current : segs;

  const idle = !pom.config && !pendingConfig;
  const isFreeflow = pom.config?.mode === "freeflow";
  const totalPoms = pom.config?.mode === "pomodoro" ? pom.config.totalPoms : 4;
  const cfg = CFG[state];
  const timerStr = isFreeflow ? pom.fmt(pom.elapsed) : pom.fmt(pom.secs);

  const handleStart = useCallback(async (cfg: SessionConfig, cameraIndex: number) => {
    setFocusing(true);
    await ctrl.startSession(cameraIndex);
    await new Promise((r) => setTimeout(r, 800));
    setPendingConfig(cfg);
    setFocusing(false);
  }, [ctrl]);

  const handleReset = useCallback(async () => {
    await ctrl.stopSession();
    setPendingConfig(null);
    setFocusing(false);
    pom.reset();
  }, [ctrl, pom]);

  const handleBreak = useCallback(() => {
    pom.start({ mode: "pomodoro", workMin: 5, breakMin: 1, totalPoms: 1 });
  }, [pom]);

  const handleCalibrated = useCallback(() => {
    if (pendingConfig) {
      pom.start(pendingConfig);
      setPendingConfig(null);
    }
  }, [pendingConfig, pom]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.code === "Space" && target?.tagName !== "INPUT" && pom.config) {
        e.preventDefault();
        pom.setRunning(!pom.running);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pom]);

  // Beat orchestration on completion: celebrate → insight → breakdown → cta
  useEffect(() => {
    if (!pom.completed) {
      setCompletedBeat("celebrate");
      return;
    }
    setCompletedBeat("celebrate");
    const t1 = setTimeout(() => setCompletedBeat("insight"), 1200);
    const t2 = setTimeout(() => setCompletedBeat("breakdown"), 3500);
    const t3 = setTimeout(() => setCompletedBeat("cta"), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pom.completed]);

  const sessionDurationMin = useMemo(() => {
    if (pom.config?.mode === "pomodoro") return pom.config.workMin * pom.config.totalPoms;
    if (pom.config?.mode === "freeflow") return Math.max(1, Math.round(pom.elapsed / 60));
    return 0;
  }, [pom.config, pom.elapsed]);

  const insight = useMemo(
    () => (pom.completed ? pickInsight(displaySegs, sessionDurationMin) : ""),
    [pom.completed, displaySegs, sessionDurationMin]
  );

  const ringSegs = [
    { color: CFG.working.hex, pct: displaySegs.working },
    { color: CFG.away.hex,    pct: displaySegs.away },
    { color: CFG.social.hex,  pct: displaySegs.social },
    { color: CFG.absent.hex,  pct: displaySegs.absent },
  ];
  const dots = Array.from({ length: Math.min(totalPoms, 8) }, (_, i) =>
    i < pom.done ? "done" : i === pom.done && pom.running && !pom.isBreak ? "curr" : "empty"
  );

  const showCalibration = pendingConfig !== null;
  const beatClass = pom.completed ? ` beat-${completedBeat}` : "";

  const envWarning = pom.running && environment?.warning ? ENV_HINT[environment.warning] : null;
  const showRecalibBanner = pom.running && calibration.recalibration_suggested;

  return (
    <div className={`bc-monitor${idle ? " welcome" : ""}${pom.completed ? " completed" : ""}${focusing ? " focusing" : ""}${beatClass}`}>
      <div
        className="bc-ambient"
        style={{
          background: idle ? CFG.working.hex : cfg.hex,
          opacity: focusing ? 0.22 : pom.running ? 0.14 : 0.05,
        }}
      />

      <div className="bc-ring-wrap">
        <Ring segs={ringSegs} idle={idle} summary={pom.completed} />
        <div className="bc-ring-center">
          <div className="bc-brain-stage">
            <div className="bc-brain-float">
              <BrainMascot
                size={132}
                color={idle ? CFG.working.hex : pom.completed ? CFG.working.hex : cfg.hex}
                state={idle ? "idle" : pom.completed ? "completed" : state}
              />
            </div>
            <div className="bc-brain-shadow" aria-hidden />
          </div>
          {pom.completed && <Sparkles />}
        </div>
      </div>

      <div className="bc-ring-info">
        {idle ? (
          <>
            <div className="bc-idle-title">Sin sesión activa</div>
            <div className="bc-idle-hint">Elige un modo para empezar</div>
          </>
        ) : pom.completed ? (
          <div className="bc-done-stack">
            <div className="bc-done-insight">{insight}</div>
            <div className="bc-done-legend">
              {STATES.map((s) => (
                <div key={s} className="bc-done-leg-item">
                  <span className="bc-done-leg-dot" style={{ background: CFG[s].hex }} />
                  <span className="bc-done-leg-lbl">{CFG[s].label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : pendingConfig ? (
          <>
            <div className="bc-idle-title">Calibrando…</div>
            <div className="bc-idle-hint">Sigue las instrucciones de la cámara</div>
          </>
        ) : (
          <>
            <div className={`bc-timer${pom.isBreak ? " brk" : isFreeflow ? " free" : ""}`}>{timerStr}</div>
            <div className="bc-timer-lbl">{isFreeflow ? (pom.running ? "libre" : "pausado") : pom.isBreak ? "descanso" : "pomodoro"}</div>
            {!isFreeflow && (
              <div className="bc-state-chip" style={{ background: cfg.bg }}>
                <div className="bc-state-chip-dot" style={{ background: cfg.hex }} />
                <span className="bc-state-chip-label" style={{ color: cfg.hex }}>{cfg.label}</span>
              </div>
            )}
          </>
        )}
      </div>

      {idle ? (
        <SessionSetup onStart={handleStart} />
      ) : pom.completed ? (
        <div className="bc-controls bc-controls-done">
          <button className="bc-ctrl-btn pp bc-done-btn" onClick={handleBreak}>
            <Coffee size={14} strokeWidth={1.75} />
            <span>Tomar descanso</span>
          </button>
          <button className="bc-ctrl-btn sec bc-done-btn-sec" onClick={handleReset}>
            <RotateCcw size={14} strokeWidth={1.75} />
            <span>Otra vez</span>
          </button>
        </div>
      ) : pendingConfig ? null : (
        <div className="bc-controls">
          <div className="bc-ctrl-row">
            <button className="bc-ctrl-btn pp" onClick={() => pom.setRunning(!pom.running)} disabled={pom.completed}>
              {pom.running ? (
                <>
                  <Pause size={14} strokeWidth={2} fill="currentColor" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play size={14} strokeWidth={2} fill="currentColor" />
                  <span>Continuar</span>
                </>
              )}
              <span className="bc-kbd">Space</span>
            </button>
            {!isFreeflow && (
              <button className="bc-ctrl-btn sec" onClick={pom.skip} title={pom.isBreak ? "Saltar descanso" : "Saltar pomodoro"} aria-label="Saltar">
                <SkipForward size={14} strokeWidth={1.75} />
                <span>Saltar</span>
              </button>
            )}
            <button className="bc-ctrl-btn dng" onClick={handleReset} title="Terminar sesión" aria-label="Terminar sesión">
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
          {!isFreeflow && (
            <div className="bc-pom-dots">
              {dots.map((d, i) => <div key={i} className={`bc-pom-dot ${d}`} />)}
              <span className="bc-pom-info">
                {pom.done}/{totalPoms} · {pom.config?.mode === "pomodoro" ? `${pom.config.workMin}/${pom.config.breakMin}` : ""} min
              </span>
            </div>
          )}
        </div>
      )}

      {showCalibration && (
        <CalibrationOverlay
          videoUrl={VIDEO_URL}
          calibration={calibration}
          environment={environment}
          onStart={() => ctrl.startCalibration()}
          onCalibrated={handleCalibrated}
        />
      )}

      {showRecalibBanner && (
        <div className="bc-toast bc-toast-recalib">
          <span>Tu postura ha cambiado</span>
          <button className="bc-toast-action" onClick={() => ctrl.requestRecalibration()}>
            Recalibrar
          </button>
        </div>
      )}

      {!showRecalibBanner && envWarning && (
        <div className="bc-toast bc-toast-env">
          <span>{envWarning}</span>
        </div>
      )}

      {camOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>
          <CameraModal open={camOpen} setOpen={setCamOpen} camOn={camOn} setCamOn={setCamOn} state={state} />
        </div>
      )}
    </div>
  );
}
