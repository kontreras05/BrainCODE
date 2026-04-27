import { useEffect } from "react";
import { Eye } from "lucide-react";
import type { CalibrationPhaseName, LiveCalibration } from "./hooks";

interface Props {
  videoUrl: string;
  calibration: LiveCalibration;
  onStart: () => void;
  onCalibrated: () => void;
}

const PHASE_LABEL: Record<CalibrationPhaseName, { title: string; hint: string }> = {
  WAITING_TO_START: {
    title: "Vamos a calibrar",
    hint: "Adopta tu postura habitual de trabajo. Esa será tu referencia.",
  },
  CENTER: {
    title: "Mira al centro de la pantalla",
    hint: "Mantén la cabeza recta, sin moverte.",
  },
  TOP_LEFT: {
    title: "Mira a la esquina superior izquierda",
    hint: "Sigue el círculo con la mirada.",
  },
  TOP_RIGHT: {
    title: "Mira a la esquina superior derecha",
    hint: "Sigue el círculo con la mirada.",
  },
  BOTTOM_RIGHT: {
    title: "Mira a la esquina inferior derecha",
    hint: "Sigue el círculo con la mirada.",
  },
  BOTTOM_LEFT: {
    title: "Mira a la esquina inferior izquierda",
    hint: "Sigue el círculo con la mirada.",
  },
  CALIBRATED: {
    title: "¡Calibración lista!",
    hint: "",
  },
};

export function CalibrationOverlay({ videoUrl, calibration, onStart, onCalibrated }: Props) {
  useEffect(() => {
    if (calibration.is_calibrated) {
      const t = setTimeout(onCalibrated, 600);
      return () => clearTimeout(t);
    }
  }, [calibration.is_calibrated, onCalibrated]);

  const phase = calibration.phase;
  const labels = PHASE_LABEL[phase] ?? PHASE_LABEL.WAITING_TO_START;
  const pct = Math.round(calibration.progress * 100);
  const isWaiting = phase === "WAITING_TO_START";

  return (
    <div className="bc-calib-wrap">
      <div className="bc-calib-card">
        <div className="bc-calib-head">
          <Eye size={18} strokeWidth={1.5} />
          <span>Calibración facial</span>
        </div>

        <div className="bc-calib-preview">
          <img src={videoUrl} alt="vista previa" className="bc-calib-preview-img" />
        </div>

        <div className="bc-calib-title">{labels.title}</div>
        <div className="bc-calib-hint">{labels.hint}</div>

        {!isWaiting && (
          <div className="bc-calib-progress">
            <div className="bc-calib-progress-bar" style={{ width: `${pct}%` }} />
            <div className="bc-calib-progress-num">{pct}%</div>
          </div>
        )}

        {isWaiting && (
          <button className="bc-ctrl-btn pp bc-calib-cta" onClick={onStart}>
            <span>Empezar calibración</span>
          </button>
        )}
      </div>
    </div>
  );
}
