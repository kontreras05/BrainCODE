import { useEffect, useRef, useState } from "react";
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

/**
 * Environment-driven micro-reaction modifiers.
 * These are CSS class names appended to the mascot wrapper to drive
 * subtle filter / transform reactions via stylesheet rules.
 */
export type MascotMood =
  | "normal"
  | "squint"      // too_dark → brightness filter
  | "confused"    // recalibration_suggested → subtle tilt
  | "sweating"    // long focus streak (>20min)
  | "glowing"     // high score (>90)
  | "drowsy";     // paused >30s

interface BrainMascotProps {
  size?: number;
  color?: string;
  state?: BrainState;
  mood?: MascotMood;
  paused?: boolean;
}

/**
 * BrainMascot with crossfade transitions.
 *
 * Instead of a hard-cut swap between state images, we keep two <img>
 * layers — the "leaving" image fades/blurs out while the "entering"
 * one fades in. The transition timing matches --dur-state (900ms).
 */
export function BrainMascot({
  size = 30,
  state = "idle",
  mood = "normal",
  paused = false,
}: BrainMascotProps) {
  const currentSrc = IMAGES[state] ?? IMAGES.idle;
  const [displaySrc, setDisplaySrc] = useState(currentSrc);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentSrc === displaySrc) return;

    // Start crossfade: show prev (outgoing) + new (incoming)
    setPrevSrc(displaySrc);
    setDisplaySrc(currentSrc);
    setTransitioning(true);

    // Clear the previous image layer after the transition completes
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPrevSrc(null);
      setTransitioning(false);
    }, 900); // matches --dur-state

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const moodClass = mood !== "normal" ? ` bc-mood-${mood}` : "";
  const pausedClass = paused ? " bc-mascot-paused" : "";

  return (
    <div
      className={`bc-mascot-wrap${moodClass}${pausedClass}`}
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      {/* Outgoing layer (fades out + blurs during crossfade) */}
      {prevSrc && transitioning && (
        <img
          src={prevSrc}
          alt=""
          draggable={false}
          className="bc-mascot-img bc-mascot-exit"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Current layer (fades in during crossfade) */}
      <img
        src={displaySrc}
        alt=""
        draggable={false}
        className={`bc-mascot-img${transitioning ? " bc-mascot-enter" : ""}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* Sweat drop overlay — shown via CSS when mood=sweating */}
      <div className="bc-mascot-sweat" aria-hidden />
    </div>
  );
}
