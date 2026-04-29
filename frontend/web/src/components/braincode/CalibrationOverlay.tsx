import { useEffect, useRef, useState } from "react";
import type { CalibrationPhaseName, LiveCalibration, LiveEnvironment } from "./hooks";

interface Props {
  videoUrl: string;
  calibration: LiveCalibration;
  environment?: LiveEnvironment;
  onStart: () => void;
  onCalibrated: () => void;
}

const PHASE_LABEL: Record<CalibrationPhaseName, { title: string; hint: string }> = {
  WAITING_TO_START: {
    title: "Vamos a centrarnos",
    hint: "Adopta tu postura habitual de trabajo. Será tu referencia.",
  },
  CENTER: {
    title: "Mira al centro de la pantalla",
    hint: "Cabeza recta. Respira.",
  },
  TOP_LEFT: {
    title: "Mira a la esquina superior izquierda",
    hint: "Sigue el punto con la mirada.",
  },
  TOP_RIGHT: {
    title: "Mira a la esquina superior derecha",
    hint: "Sigue el punto con la mirada.",
  },
  BOTTOM_RIGHT: {
    title: "Mira a la esquina inferior derecha",
    hint: "Sigue el punto con la mirada.",
  },
  BOTTOM_LEFT: {
    title: "Mira a la esquina inferior izquierda",
    hint: "Sigue el punto con la mirada.",
  },
  CALIBRATED: {
    title: "Listo.",
    hint: "",
  },
};

const ENV_HINT: Record<string, string> = {
  too_dark: "Hay poca luz — acércate a una fuente luminosa.",
  barely_visible: "Tu cara apenas se detecta — sitúate frente a la cámara.",
  moved_closer: "Te has acercado respecto a tu postura calibrada.",
  moved_further: "Te has alejado respecto a tu postura calibrada.",
};

// Posiciones absolutas (% del viewport) de cada diana de calibración.
const TARGET_POS: Partial<Record<CalibrationPhaseName, { top?: string; bottom?: string; left?: string; right?: string }>> = {
  CENTER: { top: "50%", left: "50%" },
  TOP_LEFT: { top: "8vmin", left: "8vmin" },
  TOP_RIGHT: { top: "8vmin", right: "8vmin" },
  BOTTOM_RIGHT: { bottom: "8vmin", right: "8vmin" },
  BOTTOM_LEFT: { bottom: "8vmin", left: "8vmin" },
};

export function CalibrationOverlay({ videoUrl, calibration, environment, onStart, onCalibrated }: Props) {
  const [showReady, setShowReady] = useState(false);
  const onCalibratedRef = useRef(onCalibrated);
  useEffect(() => { onCalibratedRef.current = onCalibrated; }, [onCalibrated]);

  useEffect(() => {
    if (!calibration.is_calibrated) return;
    setShowReady(true);
    const t = setTimeout(() => onCalibratedRef.current(), 700);
    return () => clearTimeout(t);
  }, [calibration.is_calibrated]);

  const phase = calibration.phase;
  const isReady = showReady || calibration.is_calibrated || phase === "CALIBRATED";
  const labels = isReady ? PHASE_LABEL.CALIBRATED : (PHASE_LABEL[phase] ?? PHASE_LABEL.WAITING_TO_START);
  const pct = Math.round(calibration.progress * 100);
  const isWaiting = phase === "WAITING_TO_START" && !isReady;

  const envWarning = environment?.warning && ENV_HINT[environment.warning];
  const targetStyle = TARGET_POS[phase];
  const isCenter = phase === "CENTER";

  return (
    <div className={`bc-calib-fs${isReady ? " ready" : ""}`} role="dialog" aria-label="Calibración">
      {videoUrl && (
        <img src={videoUrl} alt="" className="bc-calib-fs-video" aria-hidden />
      )}
      <div className="bc-calib-fs-backdrop" />

      {!isReady && targetStyle && (
        <div
          className={`bc-calib-fs-target${isCenter ? " center" : ""}`}
          style={targetStyle}
          aria-hidden
        >
          <span className="bc-calib-fs-target-pulse" />
          <span className="bc-calib-fs-target-dot" />
        </div>
      )}

      <div className="bc-calib-fs-stack">
        <div className={`bc-calib-fs-title${isReady ? " ready" : ""}`}>{labels.title}</div>
        {labels.hint && <div className="bc-calib-fs-hint">{labels.hint}</div>}
        {envWarning && !isReady && (
          <div className="bc-calib-fs-warn">{envWarning}</div>
        )}

        {isWaiting && (
          <button className="bc-ctrl-btn pp bc-calib-fs-cta" onClick={onStart}>
            <span>Empezar calibración</span>
          </button>
        )}
      </div>

      {!isWaiting && !isReady && (
        <div className="bc-calib-fs-progress">
          <div className="bc-calib-fs-progress-track">
            <div className="bc-calib-fs-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="bc-calib-fs-progress-num">{pct}%</div>
        </div>
      )}
    </div>
  );
}
