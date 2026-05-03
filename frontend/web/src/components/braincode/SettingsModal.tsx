import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronDown, RefreshCw, X } from "lucide-react";
import { waitForPyApi } from "./hooks";
import { loadLastCamera, saveLastCamera } from "./camera-prefs";

interface SettingsModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

interface CameraInfo { index: number; name: string }

export function SettingsModal({ open, setOpen }: SettingsModalProps) {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraIdx, setCameraIdx] = useState<number>(() => loadLastCamera());
  const [loading, setLoading] = useState(true);
  const [dropOpen, setDropOpen] = useState(false);

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const api = await waitForPyApi();
      if (!api) return;
      const res = await api.list_cameras();
      const list: CameraInfo[] = res?.cameras ?? [];
      setCameras(list);
      const stored = loadLastCamera();
      const hasStored = list.some((c) => c.index === stored);
      const fallback = list[0]?.index ?? 0;
      const next = hasStored ? stored : fallback;
      setCameraIdx(next);
      if (!hasStored && list.length > 0) saveLastCamera(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Error cargando cámaras", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadCameras();
  }, [open, loadCameras]);

  const handlePick = (idx: number) => {
    setCameraIdx(idx);
    saveLastCamera(idx);
    setDropOpen(false);
  };

  if (!open) return null;

  const current = cameras.find((c) => c.index === cameraIdx);
  const empty = !loading && cameras.length === 0;

  return (
    <div
      className="bc-settings-modal-wrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bc-settings-modal">
        <div className="bc-settings-head">
          <div className="bc-settings-title">Ajustes</div>
          <button
            className="bc-cam-x"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="bc-settings-section">
          <div className="bc-settings-section-head">
            <Camera size={12} strokeWidth={1.75} />
            <span>Cámara</span>
            <button
              className="bc-settings-refresh"
              onClick={loadCameras}
              disabled={loading}
              aria-label="Recargar cámaras"
              title="Recargar"
            >
              <RefreshCw size={12} strokeWidth={1.75} className={loading ? "bc-spin" : undefined} />
            </button>
          </div>

          {loading ? (
            <div className="bc-settings-loading">Buscando cámaras…</div>
          ) : empty ? (
            <div className="bc-settings-empty">No se detecta ninguna cámara</div>
          ) : (
            <div className="bc-settings-dropdown-wrap">
              <button
                className={`bc-settings-select${dropOpen ? " open" : ""}`}
                onClick={() => setDropOpen((v) => !v)}
                aria-expanded={dropOpen}
              >
                <span className="bc-settings-select-dot" />
                <span className="bc-settings-select-text">{current?.name ?? `Cámara ${cameraIdx}`}</span>
                <ChevronDown size={14} strokeWidth={1.75} className={`bc-settings-chevron${dropOpen ? " flip" : ""}`} />
              </button>
              {dropOpen && (
                <div className="bc-settings-options">
                  {cameras.map((cam) => (
                    <button
                      key={cam.index}
                      className={`bc-settings-option${cam.index === cameraIdx ? " active" : ""}`}
                      onClick={() => handlePick(cam.index)}
                    >
                      <span className="bc-settings-opt-dot" />
                      <span>{cam.name}</span>
                      {cam.index === cameraIdx && <span className="bc-settings-opt-badge">activa</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
