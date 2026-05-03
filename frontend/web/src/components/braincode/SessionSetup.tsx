import { useEffect, useState } from "react";
import { Clock, Coffee, Infinity as InfinityIcon, Play, Repeat, SlidersHorizontal } from "lucide-react";
import type { SessionConfig } from "./state";
import { loadLastCamera, saveLastCamera } from "./camera-prefs";

interface SessionSetupProps {
  onStart: (cfg: SessionConfig, cameraIndex: number) => void;
}

const STROKE = 1.5;
const LS_KEY = "bc:last-session";

type PomConfig = { mode: "pomodoro"; workMin: number; breakMin: number; totalPoms: number };
const DEFAULT_POM: PomConfig = { mode: "pomodoro", workMin: 25, breakMin: 5, totalPoms: 4 };

function loadLastSession(): PomConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_POM;
    const parsed = JSON.parse(raw);
    if (parsed?.mode === "pomodoro" &&
        typeof parsed.workMin === "number" &&
        typeof parsed.breakMin === "number" &&
        typeof parsed.totalPoms === "number") {
      return {
        mode: "pomodoro",
        workMin: Math.max(1, Math.min(120, parsed.workMin)),
        breakMin: Math.max(1, Math.min(60, parsed.breakMin)),
        totalPoms: Math.max(1, Math.min(12, parsed.totalPoms)),
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_POM;
}

function saveLastSession(cfg: SessionConfig) {
  if (cfg.mode !== "pomodoro") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [cfg, setCfg] = useState<PomConfig>(() => loadLastSession());
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    if (customizing) saveLastSession(cfg);
  }, [cfg, customizing]);

  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));

  const handleStart = (c: PomConfig) => {
    saveLastSession(c);
    const idx = loadLastCamera();
    saveLastCamera(idx);
    onStart(c, idx);
  };

  const handleFreeflow = () => {
    const idx = loadLastCamera();
    saveLastCamera(idx);
    onStart({ mode: "freeflow" }, idx);
  };

  return (
    <div className="bc-setup">
      {!customizing ? (
        <button className="bc-start-btn" onClick={() => handleStart(cfg)}>
          <Play size={14} strokeWidth={2} fill="currentColor" />
          <span>Empezar — {cfg.workMin} min</span>
        </button>
      ) : (
        <div className="bc-config-row">
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl" aria-label="Trabajo">
              <Clock size={14} strokeWidth={STROKE} />
            </span>
            <input
              className="bc-cfg-inp"
              type="number"
              min={1}
              max={120}
              value={cfg.workMin}
              onChange={(e) => setCfg((c) => ({ ...c, workMin: cl(+e.target.value, 1, 120) }))}
            />
            <span className="bc-cfg-unit">min</span>
          </div>
          <div className="bc-cfg-sep" />
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl" aria-label="Descanso">
              <Coffee size={14} strokeWidth={STROKE} />
            </span>
            <input
              className="bc-cfg-inp"
              type="number"
              min={1}
              max={60}
              value={cfg.breakMin}
              onChange={(e) => setCfg((c) => ({ ...c, breakMin: cl(+e.target.value, 1, 60) }))}
            />
            <span className="bc-cfg-unit">min</span>
          </div>
          <div className="bc-cfg-sep" />
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl" aria-label="Ciclos">
              <Repeat size={14} strokeWidth={STROKE} />
            </span>
            <input
              className="bc-cfg-inp"
              type="number"
              min={1}
              max={12}
              value={cfg.totalPoms}
              onChange={(e) => setCfg((c) => ({ ...c, totalPoms: cl(+e.target.value, 1, 12) }))}
            />
          </div>
          <div className="bc-cfg-sep" />
          <button className="bc-cfg-go" onClick={() => handleStart(cfg)}>
            <Play size={12} strokeWidth={2} fill="currentColor" />
            <span>Iniciar</span>
          </button>
        </div>
      )}

      <div className="bc-setup-secondary">
        <button
          type="button"
          className={`bc-setup-link${customizing ? " active" : ""}`}
          onClick={() => setCustomizing((v) => !v)}
          aria-expanded={customizing}
        >
          <SlidersHorizontal size={12} strokeWidth={STROKE} />
          <span>{customizing ? "Listo" : "Personalizar"}</span>
        </button>
        <span className="bc-setup-link-sep" />
        <button type="button" className="bc-setup-link" onClick={handleFreeflow}>
          <InfinityIcon size={12} strokeWidth={STROKE} />
          <span>Modo libre</span>
        </button>
      </div>
    </div>
  );
}
