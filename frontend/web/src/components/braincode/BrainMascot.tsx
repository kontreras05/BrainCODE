import { useEffect, useState } from "react";
import type { BCState } from "./state";

export type BrainState = BCState | "idle" | "completed";

type ExpressionMap = {
  pupilDx: number;
  pupilDy: number;
  asleep: boolean;
  happy: boolean;
  jitter: boolean;
};

const EXPRESSIONS: Record<BrainState, ExpressionMap> = {
  idle:      { pupilDx:  0,    pupilDy:  0,    asleep: false, happy: false, jitter: false },
  working:   { pupilDx:  0,    pupilDy:  0,    asleep: false, happy: false, jitter: false },
  away:      { pupilDx:  2.4,  pupilDy: -0.8,  asleep: false, happy: false, jitter: false },
  social:    { pupilDx:  0,    pupilDy:  0,    asleep: false, happy: false, jitter: true  },
  absent:    { pupilDx:  0,    pupilDy:  0,    asleep: true,  happy: false, jitter: false },
  completed: { pupilDx:  0,    pupilDy:  0,    asleep: false, happy: true,  jitter: false },
};

interface BrainSVGProps {
  blink: boolean;
  jitterDx: number;
  expr: ExpressionMap;
  color: string;
}

function BrainSVG({ blink, jitterDx, expr, color }: BrainSVGProps) {
  const closed = blink || expr.asleep;
  const eyeDx = expr.pupilDx + jitterDx;
  const eyeDy = expr.pupilDy;

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <path
        d="M20 18C12 18 8 26 12 32 8 38 14 46 22 44 24 50 32 52 36 48 42 52 52 48 52 40 58 36 56 26 48 24 48 16 38 12 32 18 28 14 22 14 20 18Z"
        fill={color}
        stroke={color + "66"}
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.88"
      />
      <path
        d="M22 26Q26 28 24 32M28 22Q30 26 28 30M36 22Q34 26 36 30M42 26Q40 28 42 32M30 36Q32 38 34 36"
        fill="none"
        stroke={color + "99"}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Eyes — the only point of expression */}
      {closed ? (
        <>
          <path d="M22 33Q25 35.5 28 33" stroke="#1a1208" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M36 33Q39 35.5 42 33" stroke="#1a1208" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      ) : expr.happy ? (
        <>
          <path d="M22 34Q25 30.8 28 34" stroke="#1a1208" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M36 34Q39 30.8 42 34" stroke="#1a1208" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="25" cy="33" rx="2.8" ry="3.2" fill="#fff" />
          <ellipse cx="39" cy="33" rx="2.8" ry="3.2" fill="#fff" />
          <g style={{ transition: "transform var(--dur-state) var(--ease-out)" }}>
            <circle cx={25.6 + eyeDx} cy={33.6 + eyeDy} r="1.5" fill="#1a1208" />
            <circle cx={39.6 + eyeDx} cy={33.6 + eyeDy} r="1.5" fill="#1a1208" />
            <circle cx={26.1 + eyeDx} cy={33 + eyeDy} r="0.55" fill="#fff" />
            <circle cx={40.1 + eyeDx} cy={33 + eyeDy} r="0.55" fill="#fff" />
          </g>
        </>
      )}

      {/* Cheeks (decorative, not expression) */}
      <ellipse cx="22" cy="40" rx="2.2" ry="1.3" fill={color + "88"} opacity="0.7" />
      <ellipse cx="42" cy="40" rx="2.2" ry="1.3" fill={color + "88"} opacity="0.7" />
    </svg>
  );
}

interface BrainMascotProps {
  size?: number;
  color?: string;
  state?: BrainState;
}

export function BrainMascot({ size = 30, color = "#4a8a6a", state = "idle" }: BrainMascotProps) {
  const expr = EXPRESSIONS[state] ?? EXPRESSIONS.idle;
  const [blink, setBlink] = useState(false);
  const [jitterDx, setJitterDx] = useState(0);

  useEffect(() => {
    if (expr.asleep) return;
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          go();
        }, 140);
      }, 2500 + Math.random() * 4000);
    };
    go();
    return () => clearTimeout(t);
  }, [expr.asleep]);

  useEffect(() => {
    if (!expr.jitter) {
      setJitterDx(0);
      return;
    }
    const iv = setInterval(() => {
      setJitterDx((Math.random() - 0.5) * 2);
    }, 1200);
    return () => clearInterval(iv);
  }, [expr.jitter]);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <BrainSVG blink={blink} jitterDx={jitterDx} expr={expr} color={color} />
    </div>
  );
}
