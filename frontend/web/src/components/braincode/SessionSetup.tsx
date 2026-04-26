import { useState } from "react";
import type { SessionConfig } from "./state";

interface SessionSetupProps {
  onStart: (cfg: SessionConfig) => void;
}

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [mode, setMode] = useState<"pom" | null>(null);
  const [wm, setWm] = useState(25);
  const [bm, setBm] = useState(5);
  const [pm, setPm] = useState(4);
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));

  return (
    <div className="bc-setup">
      {!mode && (
        <div className="bc-mode-row">
          <button className="bc-mode-btn pri" onClick={() => setMode("pom")}>🍅 Pomodoro</button>
          <button className="bc-mode-btn" onClick={() => onStart({ mode: "freeflow" })}>🌊 Libre</button>
        </div>
      )}
      {mode === "pom" && (
        <div className="bc-config-row">
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl">⏱</span>
            <input className="bc-cfg-inp" type="number" min={1} max={120} value={wm} onChange={(e) => setWm(cl(+e.target.value, 1, 120))} />
            <span className="bc-cfg-unit">min</span>
          </div>
          <div className="bc-cfg-sep" />
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl">☕</span>
            <input className="bc-cfg-inp" type="number" min={1} max={60} value={bm} onChange={(e) => setBm(cl(+e.target.value, 1, 60))} />
            <span className="bc-cfg-unit">min</span>
          </div>
          <div className="bc-cfg-sep" />
          <div className="bc-cfg-item">
            <span className="bc-cfg-lbl">🔁</span>
            <input className="bc-cfg-inp" type="number" min={1} max={12} value={pm} onChange={(e) => setPm(cl(+e.target.value, 1, 12))} />
          </div>
          <div className="bc-cfg-sep" />
          <button className="bc-cfg-go" onClick={() => onStart({ mode: "pomodoro", workMin: wm, breakMin: bm, totalPoms: pm })}>
            ▶ Iniciar
          </button>
        </div>
      )}
    </div>
  );
}
