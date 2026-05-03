import type { BCState } from "./state";
import concentratedImg from "./brain-images/concentrated.png";
import distractedImg from "./brain-images/distracted.png";
import sleepingImg from "./brain-images/sleeping.png";
import socialMediaImg from "./brain-images/socialMedia.png";

export type BrainState = BCState | "idle" | "completed";

const IMAGES: Record<BrainState, string> = {
  idle: sleepingImg,
  working: concentratedImg,
  away: distractedImg,
  social: socialMediaImg,
  absent: sleepingImg,
  completed: concentratedImg,
};

interface BrainMascotProps {
  size?: number;
  color?: string;
  state?: BrainState;
}

export function BrainMascot({ size = 30, state = "idle" }: BrainMascotProps) {
  const src = IMAGES[state] ?? IMAGES.idle;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
