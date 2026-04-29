import { X } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

// Selector de cámara movido a SessionSetup (se elige antes de empezar la sesión).
// Este modal queda como contenedor para futuros ajustes globales.
export function SettingsModal({ open, setOpen }: SettingsModalProps) {
  if (!open) return null;

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
          <div className="bc-settings-empty">
            La cámara se selecciona al iniciar la sesión.
          </div>
        </div>
      </div>
    </div>
  );
}
