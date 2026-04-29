import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronDown, Clock, Coffee, Infinity as InfinityIcon, Play, Repeat, SlidersHorizontal } from "lucide-react";
import type { SessionConfig } from "./state";
import { waitForPyApi } from "./hooks";

interface CameraInfo { index: number; name: string }

interface SessionSetupProps {
  onStart: (cfg: SessionConfig, cameraIndex: number) => void;
}

const STROKE = 1.5;
const LS_KEY = "bc:last-session";
const CAM_KEY = "bc:last-camera-index";

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

function loadLastCamera(): number {
  try {
    const raw = localStorage.getItem(CAM_KEY);
    if (raw === null) return 0;
    const idx = parseInt(raw, 10);
    return Number.isFinite(idx) ? idx : 0;
  } catch {
    return 0;
  }
}

function saveLastCamera(idx: number) {
  try { localStorage.setItem(CAM_KEY, String(idx)); } catch { /* ignore */ }
}

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [cfg, setCfg] = useState<PomConfig>(() => loadLastSession());
  const [customizing, setCustomizing] = useState(false);

  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraIdx, setCameraIdx] = useState<number>(() => loadLastCamera());
  const [camLoading, setCamLoading] = useState(true);
  const [camDropOpen, setCamDropOpen] = useState(false);

  const loadCameras = useCallback(async () => {
    setCamLoading(true);
    try {
      const api = await waitForPyApi();
      if (!api) return;
      const res = await api.list_cameras();
      if (res?.cameras) {
        setCameras(res.cameras);
        // Si la última cámara guardada ya no existe, caer en la primera disponible.
        const stored = loadLastCamera();
        const hasStored = res.cameras.some((c: CameraInfo) => c.index === stored);
        const fallback = res.cameras[0]?.index ?? 0;
        setCameraIdx(hasStored ? stored : fallback);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Error cargando cámaras", err);
    } finally {
      setCamLoading(false);
    }
  }, []);

  useEffect(() => { loadCameras(); }, [loadCameras]);

  useEffect(() => {
    if (customizing) saveLastSession(cfg);
  }, [cfg, customizing]);

  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));

  const handleStart = (c: PomConfig) => {
    saveLastSession(c);
    saveLastCamera(cameraIdx);
    onStart(c, cameraIdx);
  };

  const handleFreeflow = () => {
    saveLastCamera(cameraIdx);
    onStart({ mode: "freeflow" }, cameraIdx);
  };

  const currentCam = cameras.find((c) => c.index === cameraIdx);
  const noCameras = !camLoading && cameras.length === 0;
  const showSelector = cameras.length > 1; // si solo hay una, mostramos solo el nombre

  return (
    <div className="bc-setup">
      {!customizing ? (
        <button className="bc-start-btn" onClick={() => handleStart(cfg)} disabled={noCameras}>
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
          <button className="bc-cfg-go" onClick={() => handleStart(cfg)} disabled={noCameras}>
            <Play size={12} strokeWidth={2} fill="currentColor" />
            <span>Iniciar</span>
          </button>
        </div>
      )}

      <div className="bc-setup-cam">
        <Camera size={12} strokeWidth={STROKE} />
        {camLoading ? (
          <span className="bc-setup-cam-text muted">Buscando cámaras…</span>
        ) : noCameras ? (
          <span className="bc-setup-cam-text warn">No se detecta cámara</span>
        ) : showSelector ? (
          <div className="bc-setup-cam-wrap">
            <button
              className={`bc-setup-cam-btn${camDropOpen ? " open" : ""}`}
              onClick={() => setCamDropOpen((v) => !v)}
              aria-expanded={camDropOpen}
            >
              <span className="bc-setup-cam-text">{currentCam?.name ?? `Cámara ${cameraIdx}`}</span>
              <ChevronDown size={10} strokeWidth={2} className={`bc-setup-cam-chev${camDropOpen ? " flip" : ""}`} />
            </button>
            {camDropOpen && (
              <div className="bc-setup-cam-options">
                {cameras.map((cam) => (
                  <button
                    key={cam.index}
                    className={`bc-setup-cam-opt${cam.index === cameraIdx ? " active" : ""}`}
                    onClick={() => { setCameraIdx(cam.index); setCamDropOpen(false); }}
                  >
                    <span>{cam.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="bc-setup-cam-text">{currentCam?.name ?? `Cámara ${cameraIdx}`}</span>
        )}
      </div>

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
        <button type="button" className="bc-setup-link" onClick={handleFreeflow} disabled={noCameras}>
          <InfinityIcon size={12} strokeWidth={STROKE} />
          <span>Modo libre</span>
        </button>
      </div>
    </div>
  );
}
