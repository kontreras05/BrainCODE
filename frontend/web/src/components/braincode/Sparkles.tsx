import type { CSSProperties } from "react";

const SPARKS = [
  { tx: "-58px", ty: "-78px", c: "#4a8a6a", d: "1.2s", e: "★" },
  { tx: "62px",  ty: "-74px", c: "#b87e28", d: "1.4s", e: "✦" },
  { tx: "-88px", ty: "-22px", c: "#c85540", d: "1.0s", e: "✦" },
  { tx: "90px",  ty: "-18px", c: "#4a8a6a", d: "1.3s", e: "★" },
  { tx: "-44px", ty:  "78px", c: "#b87e28", d: "1.1s", e: "✦" },
  { tx: "48px",  ty:  "80px", c: "#4a8a6a", d: "1.5s", e: "★" },
];

export function Sparkles() {
  return (
    <>
      {SPARKS.map((s, i) => (
        <div
          key={i}
          className="bc-spark"
          style={{ ["--tx" as never]: s.tx, ["--ty" as never]: s.ty, ["--d" as never]: s.d, color: s.c } as CSSProperties}
        >
          {s.e}
        </div>
      ))}
    </>
  );
}
