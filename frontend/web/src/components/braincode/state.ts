export type BCState = "working" | "away" | "social" | "absent";

export const STATES: BCState[] = ["working", "away", "social", "absent"];

export interface StateConfig {
  hex: string;
  label: string;
  bg: string;
  icon: string;
}

export const CFG: Record<BCState, StateConfig> = {
  working: { hex: "#4a8a6a", label: "Trabajando",     bg: "oklch(52% 0.13 155 / 0.1)", icon: "💻" },
  away:    { hex: "#c85540", label: "Distraído",      bg: "oklch(57% 0.18 25 / 0.1)",  icon: "👀" },
  social:  { hex: "#b87e28", label: "Redes sociales", bg: "oklch(64% 0.16 65 / 0.1)",  icon: "📱" },
  absent:  { hex: "#8a7a6a", label: "Ausente",        bg: "oklch(58% 0.02 60 / 0.1)",  icon: "😴" },
};

export type SessionConfig =
  | { mode: "freeflow" }
  | { mode: "pomodoro"; workMin: number; breakMin: number; totalPoms: number };
