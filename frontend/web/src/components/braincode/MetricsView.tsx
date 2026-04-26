import { useState } from "react";
import { CFG } from "./state";

export function MetricsView() {
  const [period, setPeriod] = useState("Hoy");

  const stats: Array<{ label: string; val: string; delta: string; up: boolean | null; color: string; pct: number }> = [
    { label: "Tiempo activo",  val: "4h 32m", delta: "+12%", up: true,  color: CFG.working.hex, pct: 0.72 },
    { label: "Distracciones",  val: "23",     delta: "−5",   up: true,  color: CFG.away.hex,    pct: 0.38 },
    { label: "Redes sociales", val: "18 min", delta: "+3m",  up: false, color: CFG.social.hex,  pct: 0.25 },
    { label: "Ausencias",      val: "2",      delta: "=",    up: null,  color: CFG.absent.hex,  pct: 0.12 },
  ];

  const hourly = [
    { h: "9h",  w: 0.9,  a: 0.05, s: 0.04, ab: 0.01 },
    { h: "10h", w: 0.7,  a: 0.1,  s: 0.15, ab: 0.05 },
    { h: "11h", w: 0.8,  a: 0.1,  s: 0.05, ab: 0.05 },
    { h: "12h", w: 0.3,  a: 0.2,  s: 0.3,  ab: 0.2  },
    { h: "13h", w: 0.1,  a: 0.1,  s: 0.1,  ab: 0.7  },
    { h: "14h", w: 0.6,  a: 0.2,  s: 0.1,  ab: 0.1  },
    { h: "15h", w: 0.85, a: 0.05, s: 0.05, ab: 0.05 },
    { h: "16h", w: 0.75, a: 0.1,  s: 0.1,  ab: 0.05 },
    { h: "17h", w: 0.5,  a: 0.2,  s: 0.2,  ab: 0.1  },
  ];

  return (
    <div className="bc-metrics">
      <div className="bc-mhdr">
        <div>
          <div className="bc-mhdr-title">Productividad</div>
          <div className="bc-mhdr-sub">Sábado 25 de abril · Semana 17</div>
        </div>
        <div className="bc-periods">
          {["Hoy", "Semana", "Mes"].map((p) => (
            <div key={p} className={`bc-period${period === p ? " on" : ""}`} onClick={() => setPeriod(p)}>{p}</div>
          ))}
        </div>
      </div>

      <div className="bc-streak-card">
        <div className="bc-streak-fire">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1 C6 1 8 3 8 5 C8 6.5 7 7.5 6 8 C6 8 7 6.5 5.5 5.5 C4 4.5 4 6 4 7 C3 6 2.5 4.5 3.5 3 C4.5 1.5 6 1 6 1Z"
              fill="oklch(57% 0.18 25)"
            />
          </svg>
        </div>
        <div>
          <div className="bc-streak-num">3 días</div>
          <div className="bc-streak-lbl">Racha actual · Mejor: 7 días</div>
        </div>
        <div className="bc-streak-badge">RACHA ACTIVA</div>
      </div>

      <div className="bc-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="bc-stat-card">
            <div className="bc-stat-top">
              <div className="bc-stat-label">{s.label}</div>
              <div className="bc-stat-ico" style={{ background: s.color }} />
            </div>
            <div className="bc-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="bc-stat-bar">
              <div className="bc-stat-bar-fill" style={{ width: `${s.pct * 100}%`, background: s.color, opacity: 0.7 }} />
            </div>
            <div
              className="bc-stat-delta"
              style={{
                background: s.up === null ? "var(--bc-surface-2)" : s.up ? "oklch(52% 0.13 155 / 0.1)" : "oklch(57% 0.18 25 / 0.1)",
                color: s.up === null ? "var(--bc-text-muted)" : s.up ? "var(--bc-green)" : "var(--bc-red)",
              }}
            >
              {s.delta} vs ayer
            </div>
          </div>
        ))}
      </div>

      <div className="bc-tl-card">
        <div className="bc-tl-head">
          <span className="bc-tl-title">Actividad por hora</span>
          <div className="bc-tl-legend">
            {Object.entries(CFG).map(([k, v]) => (
              <div key={k} className="bc-tl-li">
                <div className="bc-tl-dot" style={{ background: v.hex }} />
                {v.label}
              </div>
            ))}
          </div>
        </div>
        <div className="bc-tl-bars">
          {hourly.map((d, i) => (
            <div key={i} className="bc-tl-col">
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2 }}>
                {[
                  { p: d.w,  c: CFG.working.hex },
                  { p: d.a,  c: CFG.away.hex },
                  { p: d.s,  c: CFG.social.hex },
                  { p: d.ab, c: CFG.absent.hex },
                ].map(
                  (s, j) =>
                    s.p > 0.02 && (
                      <div
                        key={j}
                        className="bc-tl-seg"
                        style={{ height: `${s.p * 100}%`, background: s.c, opacity: 0.82 }}
                      />
                    )
                )}
              </div>
              <div className="bc-tl-lbl">{d.h}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
