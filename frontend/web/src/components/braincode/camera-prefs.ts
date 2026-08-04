export const CAM_KEY = "bc:last-camera-index";

export function loadLastCamera(): number {
  try {
    const raw = localStorage.getItem(CAM_KEY);
    if (raw === null) return 0;
    const idx = parseInt(raw, 10);
    return Number.isFinite(idx) ? idx : 0;
  } catch {
    return 0;
  }
}

export function saveLastCamera(idx: number) {
  try { localStorage.setItem(CAM_KEY, String(idx)); } catch { /* ignore */ }
}
