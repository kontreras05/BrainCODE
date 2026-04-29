import type { CSSProperties } from "react";

const SPARKS = [
  { tx: -52, ty: -76, c: "#4a8a6a", d: "1.6s", size: 4, delay: "0.05s" },
  { tx:  56, ty: -64, c: "#b87e28", d: "1.8s", size: 3, delay: "0.15s" },
  { tx: -88, ty: -16, c: "#4a8a6a", d: "1.5s", size: 5, delay: "0.00s" },
  { tx:  92, ty:  -8, c: "#b87e28", d: "1.7s", size: 3, delay: "0.20s" },
  { tx: -44, ty:  62, c: "#4a8a6a", d: "2.0s", size: 4, delay: "0.25s" },
  { tx:  48, ty:  72, c: "#b87e28", d: "1.9s", size: 5, delay: "0.10s" },
  { tx:  -8, ty: -94, c: "#4a8a6a", d: "1.4s", size: 3, delay: "0.30s" },
  { tx:  14, ty:  88, c: "#b87e28", d: "1.6s", size: 4, delay: "0.18s" },
  { tx: -72, ty:  34, c: "#4a8a6a", d: "1.7s", size: 3, delay: "0.22s" },
  { tx:  78, ty:  30, c: "#b87e28", d: "1.5s", size: 4, delay: "0.08s" },
];

export function Sparkles() {
  return (
    <div className="bc-sparks-wrap" aria-hidden>
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="bc-spark"
          style={{
            ["--tx" as never]: `${s.tx}px`,
            ["--ty" as never]: `${s.ty}px`,
            ["--d" as never]: s.d,
            ["--size" as never]: `${s.size}px`,
            ["--bg" as never]: s.c,
            animationDelay: s.delay,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
