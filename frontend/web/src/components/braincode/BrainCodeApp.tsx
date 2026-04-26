import { useEffect, useState } from "react";
import { Activity, BarChart3, Bell, Camera, FlaskConical, Settings } from "lucide-react";
import { MonitorView } from "./MonitorView";
import { MetricsView } from "./MetricsView";
import { JarsView } from "./JarsView";
import { CameraModal } from "./CameraModal";
import { CFG, type BCState } from "./state";

const ICON_STROKE = 1.5;
const ICON_NAV = 16;

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
              { id: "monitor" as const, Icon: Activity, label: "Monitor" },
              { id: "metrics" as const, Icon: BarChart3, label: "Métricas" },
              { id: "jars" as const, Icon: FlaskConical, label: "Jars" },
            ]).map((n) => (
              <button key={n.id} className={`bc-nav-btn${tab === n.id ? " active" : ""}`} onClick={() => setTab(n.id)}>
                <span className="bc-nav-icon">
                  <n.Icon size={ICON_NAV} strokeWidth={ICON_STROKE} />
                </span>
                {n.label}
              </button>
            ))}
            <button className="bc-nav-btn" onClick={() => setCamOpen(!camOpen)}>
              <span className="bc-nav-icon">
                <Camera size={ICON_NAV} strokeWidth={ICON_STROKE} />
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
              <span className="bc-nav-icon">
                <Settings size={ICON_NAV} strokeWidth={ICON_STROKE} />
              </span>
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
              <Bell size={16} strokeWidth={ICON_STROKE} />
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
