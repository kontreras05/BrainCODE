import type React from "react";

interface Seg {
  color: string;
  pct: number;
}

function arc(cx: number, cy: number, r: number, s: number, e: number) {
  if (Math.abs(e - s) < 0.001) return "";
  return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${
    e - s > Math.PI ? 1 : 0
  } 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
}

interface RingProps {
  segs: Seg[];
  idle: boolean;
  summary?: boolean;
}

export function Ring({ segs, idle, summary = false }: RingProps) {
  const cx = 150, cy = 150, r = 116, sw = 30, TAU = 2 * Math.PI;
  let a = 0;
  const built = segs.map((s) => {
    const o = { ...s, s0: a, s1: a + TAU * s.pct };
    a = o.s1;
    return o;
  });
  const track = idle ? "oklch(89% 0.016 225)" : "oklch(89% 0.014 225)";
  const dotRadius = r + sw / 2 + 14;
  const dotColor = "oklch(60% 0.03 225)";
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * TAU;
    const dotCx = cx + dotRadius * Math.cos(ang);
    const dotCy = cy + dotRadius * Math.sin(ang);
    const finalOpacity = 0.4;
    return (
      <circle
        key={i}
        className={idle ? undefined : "bc-tick-reveal"}
        style={
          idle
            ? { opacity: finalOpacity }
            : ({
                animationDelay: `${0.8 + (i / 12) * 1}s`,
                ["--bc-tick-op" as string]: finalOpacity,
              } as React.CSSProperties)
        }
        cx={dotCx}
        cy={dotCy}
        r={2.5}
        fill={dotColor}
      />
    );
  });
  const labelR = r + sw / 2 + 24;
  return (
    <svg width="300" height="300" className="bc-ring-svg" style={{ overflow: "visible" }}>
      <g className={`bc-ring-ticks ${idle ? "idle" : "reveal"}`}>{ticks}</g>
      {/* Track: dashed when idle, animated draw-around when active */}
      <circle
        key={idle ? "idle" : "active"}
        className={`bc-ring-track ${idle ? "idle" : "reveal"}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={sw}
        strokeLinecap={idle ? "round" : "butt"}
      />
      {!idle &&
        built.map(
          (s, i) =>
            s.pct >= 0.005 && (
              <path
                key={i}
                className={`bc-ring-seg${summary ? " summary" : ""}`}
                style={{ animationDelay: "0.7s" }}
                d={arc(cx, cy, r, s.s0, s.s1)}
                fill="none"
                stroke={s.color}
                strokeWidth={sw}
                strokeLinecap="butt"
                opacity="1"
              />
            )
        )}
      {summary &&
        built.map((s, i) => {
          if (s.pct < 0.03) return null;
          const mid = (s.s0 + s.s1) / 2;
          const x = cx + labelR * Math.cos(mid);
          const y = cy + labelR * Math.sin(mid);
          const pct = Math.round(s.pct * 100);
          return (
            <text
              key={`lbl-${i}`}
              className="bc-ring-pct"
              x={x}
              y={y}
              fill={s.color}
              transform={`rotate(90 ${x} ${y})`}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ animationDelay: `${0.3 + i * 0.12}s` }}
            >
              {pct}%
            </text>
          );
        })}
    </svg>
  );
}
