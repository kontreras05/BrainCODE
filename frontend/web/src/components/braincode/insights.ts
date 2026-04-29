import type { BCState } from "./state";

export type Segs = Record<BCState, number>;

export function pickInsight(segs: Segs, durationMin: number): string {
  const workingMin = Math.max(0, Math.round(segs.working * durationMin));
  const socialMin = Math.max(0, Math.round(segs.social * durationMin));
  const awayPct = Math.round(segs.away * 100);

  if (segs.working >= 0.92) {
    return `Sesión limpia: ${workingMin} min en flow.`;
  }
  if (segs.social > 0.15) {
    return `Las redes te robaron ${socialMin} min.`;
  }
  if (segs.away > 0.20) {
    return `Atención fragmentada: ${awayPct}% del tiempo distraído.`;
  }
  if (segs.absent > 0.15) {
    return `Demasiadas ausencias. ¿Pausa larga la próxima?`;
  }
  return `${workingMin} min de foco.`;
}
