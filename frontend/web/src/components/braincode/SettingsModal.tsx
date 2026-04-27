import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { waitForPyApi } from "./hooks";

interface CameraInfo {
  index: number;
  name: string;
}

interface SettingsModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export function SettingsModal({ open, setOpen }: SettingsModalProps) {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const api = await waitForPyApi();
      if (!api) return;
      const res = await api.list_cameras();
      if (res?.cameras) {
        setCameras(res.cameras);
        setCurrent(res.current ?? 0);
      }
    } catch (err) {
      console.warn("Error loading cameras", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadCameras();
  }, [open, loadCameras]);

  const selectCamera = useCallback(async (idx: number) => {
    if (idx === current) {
      setDropdownOpen(false);
      return;
    }
    setSwitching(true);
    setDropdownOpen(false);
    try {
      const api = await waitForPyApi();
      if (!api) return;
      const res = await api.set_camera(idx);
      if (res?.ok) {
        setCurrent(idx);
      }
    } catch (err) {
      console.warn("Error setting camera", err);
    } finally {
      setSwitching(false);
    }
  }, [current]);

  if (!open) return null;

  const currentCam = cameras.find((c) => c.index === current);

  return (
    <div
      className="bc-settings-modal-wrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bc-settings-modal">
        {/* Header */}
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

        {/* Camera Section */}
        <div className="bc-settings-section">
          <div className="bc-settings-section-head">
            <Camera size={14} strokeWidth={1.5} />
            <span>Cámara</span>
            <button
              className="bc-settings-refresh"
              onClick={loadCameras}
              disabled={loading}
              title="Buscar cámaras"
            >
              <RefreshCw
                size={12}
                strokeWidth={1.5}
                className={loading ? "bc-spin" : ""}
              />
            </button>
          </div>

          {loading && cameras.length === 0 ? (
            <div className="bc-settings-loading">
              <Loader2 size={16} strokeWidth={1.5} className="bc-spin" />
              <span>Buscando cámaras…</span>
            </div>
          ) : cameras.length === 0 ? (
            <div className="bc-settings-empty">
              No se encontraron cámaras
            </div>
          ) : (
            <div className="bc-settings-dropdown-wrap">
              <button
                className={`bc-settings-select${dropdownOpen ? " open" : ""}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={switching}
              >
                <span className="bc-settings-select-dot" />
                <span className="bc-settings-select-text">
                  {switching
                    ? "Cambiando…"
                    : currentCam
                      ? currentCam.name
                      : `Cámara ${current}`}
                </span>
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={`bc-settings-chevron${dropdownOpen ? " flip" : ""}`}
                />
              </button>
              {dropdownOpen && (
                <div className="bc-settings-options">
                  {cameras.map((cam) => (
                    <button
                      key={cam.index}
                      className={`bc-settings-option${cam.index === current ? " active" : ""}`}
                      onClick={() => selectCamera(cam.index)}
                    >
                      <span className="bc-settings-opt-dot" />
                      <span>{cam.name}</span>
                      {cam.index === current && (
                        <span className="bc-settings-opt-badge">Activa</span>
                      )}
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
