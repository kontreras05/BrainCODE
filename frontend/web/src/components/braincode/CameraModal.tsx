import { useState } from "react";
import { X } from "lucide-react";
import { CFG, type BCState } from "./state";

const VIDEO_URL = "http://127.0.0.1:8765/video_feed";

interface CameraModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  camOn: boolean;
  setCamOn: (v: boolean) => void;
  state: BCState;
}

export function CameraModal({ open, setOpen, camOn, setCamOn, state }: CameraModalProps) {
  const [feedError, setFeedError] = useState(false);

  if (!open) return null;
  const cfg = CFG[state];
  const StateIcon = cfg.Icon;

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
          <button className="bc-cam-x" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
        <div className="bc-cam-feed">
          {!camOn ? (
            <div className="bc-cam-off-view">
              <div style={{ fontSize: 20, opacity: 0.3 }}>◉</div>
              <div>Cámara apagada</div>
              <button
                className="bc-cam-on-btn"
                style={{ marginTop: 4 }}
                onClick={() => { setFeedError(false); setCamOn(true); }}
              >Activar</button>
            </div>
          ) : feedError ? (
            <div className="bc-cam-off-view">
              <div style={{ fontSize: 20, opacity: 0.3 }}>◉</div>
              <div>No hay señal del backend</div>
              <button
                className="bc-cam-on-btn"
                style={{ marginTop: 4 }}
                onClick={() => setFeedError(false)}
              >Reintentar</button>
            </div>
          ) : (
            <div className="bc-cam-live-view">
              <img
                src={VIDEO_URL}
                alt="cámara"
                className="bc-cam-feed-img"
                onError={() => setFeedError(true)}
              />
              <div className="bc-rec" />
            </div>
          )}
        </div>
        {camOn && (
          <div className="bc-cam-state-bar" style={{ background: cfg.bg, color: cfg.hex }}>
            <StateIcon size={14} strokeWidth={1.5} />
            <span style={{ flex: 1, fontWeight: 600 }}>{cfg.label}</span>
            <button className="bc-cam-off-btn" onClick={() => setCamOn(false)}>Apagar</button>
          </div>
        )}
      </div>
    </div>
  );
}
