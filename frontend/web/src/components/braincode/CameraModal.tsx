import { CFG, type BCState } from "./state";

interface CameraModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  camOn: boolean;
  setCamOn: (v: boolean) => void;
  state: BCState;
}

export function CameraModal({ open, setOpen, camOn, setCamOn, state }: CameraModalProps) {
  if (!open) return null;
  const cfg = CFG[state];
  const fc = state === "away" ? "away" : state === "social" ? "distracted" : state === "absent" ? "absent" : "";
  return (
    <div
      className="bc-cam-modal-wrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bc-cam-modal">
        <div className="bc-cam-head">
          <div className="bc-cam-title">Detección facial</div>
          <button className="bc-cam-x" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="bc-cam-feed">
          {!camOn ? (
            <div className="bc-cam-off-view">
              <div style={{ fontSize: 20, opacity: 0.3 }}>◉</div>
              <div>Cámara apagada</div>
              <button className="bc-cam-on-btn" style={{ marginTop: 4 }} onClick={() => setCamOn(true)}>Activar</button>
            </div>
          ) : (
            <div className="bc-cam-live-view">
              <div className="bc-cam-scan" />
              <div className={`bc-face-box ${fc}`}>
                <div className="bc-fc tl" /><div className="bc-fc tr" /><div className="bc-fc bl" /><div className="bc-fc br" />
              </div>
              <div className="bc-rec" />
            </div>
          )}
        </div>
        {camOn && (
          <div className="bc-cam-state-bar" style={{ background: cfg.bg, color: cfg.hex }}>
            <span>{cfg.icon}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{cfg.label}</span>
            <button className="bc-cam-off-btn" onClick={() => setCamOn(false)}>Apagar</button>
          </div>
        )}
      </div>
    </div>
  );
}
