import { useEffect, useState } from "react";
import { MonitorView } from "./MonitorView";
import { MetricsView } from "./MetricsView";
import { JarsView } from "./JarsView";
import { CameraModal } from "./CameraModal";
import { CFG, type BCState } from "./state";

type Tab = "monitor" | "metrics" | "jars";

export function BrainCodeApp() {
  const [tab, setTab] = useState<Tab>("monitor");
  const [globalState, setGlobalState] = useState<BCState>("working");
  const [camOn, setCamOn] = useState(true);
  const [camOpen, setCamOpen] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => {
      const ev = e as CustomEvent<BCState>;
      if (ev.detail) setGlobalState(ev.detail);
    };
    window.addEventListener("bc-state", onState);
    return () => window.removeEventListener("bc-state", onState);
  }, []);

  const cfg = CFG[globalState];

  return (
    <div className="bc-app">
      <div className="bc-window">
        {/* SIDEBAR */}
        <div className="bc-sidebar">
          <div className="bc-sb-titlebar">
            <div className="bc-tls">
              <div className="bc-tl bc-tl-r" />
              <div className="bc-tl bc-tl-y" />
              <div className="bc-tl bc-tl-g" />
            </div>
            <span className="bc-brand">Brain<em>CODE</em></span>
          </div>

          <div className="bc-orb-wrap">
            <div className="bc-orb">
              <div className="bc-orb-num">72</div>
              <div className="bc-orb-sub">score</div>
            </div>
            <div className="bc-orb-stats">
              <div className="bc-orb-time">4h 32m enfocado</div>
              <div className="bc-orb-streak">3 días de racha</div>
            </div>
          </div>

          <nav className="bc-nav">
            {([
              { id: "monitor" as const, icon: "◎", label: "Monitor" },
              { id: "metrics" as const, icon: "≡", label: "Métricas" },
              {
                id: "jars" as const,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="5.5" width="9" height="7" rx="2.5" />
                    <rect x="3.5" y="3" width="7" height="3" rx="1.5" />
                    <line x1="5.5" y1="3" x2="5.5" y2="5.5" />
                    <line x1="8.5" y1="3" x2="8.5" y2="5.5" />
                  </svg>
                ),
                label: "Jars",
              },
            ]).map((n) => (
              <button key={n.id} className={`bc-nav-btn${tab === n.id ? " active" : ""}`} onClick={() => setTab(n.id)}>
                <span className="bc-nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
            <button className="bc-nav-btn" onClick={() => setCamOpen(!camOpen)}>
              <span className="bc-nav-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <rect x="1" y="4" width="14" height="10" rx="2.5" />
                  <circle cx="8" cy="9" r="2.5" />
                  <path d="M5.5 4L6.8 2H9.2L10.5 4" />
                </svg>
              </span>
              Cámara
            </button>
          </nav>

          <div className="bc-sb-bottom">
            <button className="bc-cam-status" onClick={() => setCamOpen(!camOpen)}>
              <div className={`bc-cam-dot${camOn ? " live" : ""}`} style={{ background: camOn ? cfg.hex : "oklch(45% 0.02 60)" }} />
              <span>{camOn ? cfg.label : "Cámara apagada"}</span>
            </button>
            <button className="bc-cam-status" style={{ opacity: 0.45, cursor: "default", pointerEvents: "none" }}>
              <span className="bc-nav-icon" style={{ fontSize: 13 }}>⚙</span>
              <span>Ajustes</span>
            </button>
          </div>
        </div>

        {/* MAIN */}
        <div className="bc-main">
          <div className="bc-main-bar">
            <span className="bc-main-bar-title">
              {tab === "monitor" ? "Monitor de Sesión" : tab === "metrics" ? "Métricas de Productividad" : "Tarros de Sesión"}
            </span>
            <span className="bc-main-bar-sub">
              {tab === "monitor" ? "· Detección en tiempo real" : tab === "metrics" ? "· Sáb 25 abril" : "· Historial de sesiones"}
            </span>
            <button className="bc-icon-btn" title="Notificaciones" aria-label="Notificaciones">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
          </div>

          <div key={tab} className="bc-tab-pane">
            {tab === "monitor" && (
              <MonitorView camOn={camOn} setCamOn={setCamOn} camOpen={camOpen} setCamOpen={setCamOpen} />
            )}
            {tab === "metrics" && <MetricsView />}
            {tab === "jars" && <JarsView />}
          </div>
          {camOpen && tab !== "monitor" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>
              <CameraModal open={camOpen} setOpen={setCamOpen} camOn={camOn} setCamOn={setCamOn} state={globalState} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
