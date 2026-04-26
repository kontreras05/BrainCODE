import { useEffect } from "react";
import { Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { BrainMascot } from "./BrainMascot";
import { Ring } from "./Ring";
import { SessionSetup } from "./SessionSetup";
import { Sparkles } from "./Sparkles";
import { CameraModal } from "./CameraModal";
import { usePomodoro, useSim } from "./hooks";
import { CFG } from "./state";

interface MonitorViewProps {
  camOn: boolean;
  setCamOn: (v: boolean) => void;
  camOpen: boolean;
  setCamOpen: (v: boolean) => void;
}

export function MonitorView({ camOn, setCamOn, camOpen, setCamOpen }: MonitorViewProps) {
  const pom = usePomodoro();
  const { state, segs } = useSim(pom.running);
  const idle = !pom.config;
  const isFreeflow = pom.config?.mode === "freeflow";
  const totalPoms = pom.config?.mode === "pomodoro" ? pom.config.totalPoms : 4;
  const cfg = CFG[state];
  const timerStr = isFreeflow ? pom.fmt(pom.elapsed) : pom.fmt(pom.secs);

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

  const ringSegs = [
    { color: CFG.working.hex, pct: segs.working },
    { color: CFG.away.hex,    pct: segs.away },
    { color: CFG.social.hex,  pct: segs.social },
    { color: CFG.absent.hex,  pct: segs.absent },
  ];
  const dots = Array.from({ length: Math.min(totalPoms, 8) }, (_, i) =>
    i < pom.done ? "done" : i === pom.done && pom.running && !pom.isBreak ? "curr" : "empty"
  );

  return (
    <div className={`bc-monitor${idle ? " welcome" : ""}${pom.completed ? " completed" : ""}`}>
      <div
        className="bc-ambient"
        style={{
          background: idle ? CFG.working.hex : cfg.hex,
          opacity: pom.running ? 0.14 : 0.05,
        }}
      />

      <div className="bc-ring-wrap">
        <Ring segs={ringSegs} idle={idle} />
        <div className="bc-ring-center">
          <div className="bc-brain-stage">
            <div className="bc-brain-float">
              <BrainMascot size={132} color={idle ? CFG.working.hex : pom.completed ? CFG.working.hex : cfg.hex} />
            </div>
            <div className="bc-brain-shadow" aria-hidden />
          </div>
        </div>
      </div>

      <div className="bc-ring-info">
        {idle ? (
          <>
            <div className="bc-idle-title">Sin sesión activa</div>
            <div className="bc-idle-hint">Elige un modo para empezar</div>
          </>
        ) : pom.completed ? (
          <>
            <div className="bc-done-title">¡Sesión completada!</div>
            <div className="bc-done-metrics">
              {[
                { key: "working", label: "Trabajando", pct: segs.working },
                { key: "away",    label: "Distraído",  pct: segs.away },
                { key: "social",  label: "Redes",      pct: segs.social },
                { key: "absent",  label: "Ausente",    pct: segs.absent },
              ].map((m, i) => {
                const cfg = CFG[m.key as keyof typeof CFG];
                return (
                  <div key={m.key} className="bc-done-metric" style={{ animationDelay: `${0.55 + i * 0.1}s` }}>
                    <div className="bc-done-metric-dot" style={{ background: cfg.hex }} />
                    <div className="bc-done-metric-lbl">{m.label}</div>
                    <div className="bc-done-metric-val" style={{ color: cfg.hex }}>{Math.round(m.pct * 100)}%</div>
                  </div>
                );
              })}
            </div>
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
        <SessionSetup onStart={pom.start} />
      ) : pom.completed ? (
        <div className="bc-controls bc-controls-done" style={{ position: "relative" }}>
          <Sparkles />
          <button className="bc-ctrl-btn pp bc-done-btn" onClick={pom.reset}>
            <RotateCcw size={14} strokeWidth={1.75} />
            <span>Nueva sesión</span>
          </button>
        </div>
      ) : (
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
            <button className="bc-ctrl-btn dng" onClick={pom.reset} title="Terminar sesión" aria-label="Terminar sesión">
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

      {camOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>
          <CameraModal open={camOpen} setOpen={setCamOpen} camOn={camOn} setCamOn={setCamOn} state={state} />
        </div>
      )}
    </div>
  );
}
