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
  const track = idle ? "oklch(89% 0.016 62)" : "oklch(89% 0.014 62)";
  const tickOuter = r + sw / 2 + 22;
  const tickColor = "oklch(60% 0.02 62)";
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const len = isHour ? 10 : 4;
    const inner = tickOuter - len;
    const ang = (i / 60) * TAU;
    const x1 = cx + tickOuter * Math.cos(ang);
    const y1 = cy + tickOuter * Math.sin(ang);
    const x2 = cx + inner * Math.cos(ang);
    const y2 = cy + inner * Math.sin(ang);
    const finalOpacity = isHour ? 0.55 : 0.3;
    return (
      <line
        key={i}
        className={idle ? undefined : "bc-tick-reveal"}
        style={
          idle
            ? { opacity: finalOpacity }
            : ({
                animationDelay: `${0.8 + (i / 60) * 1}s`,
                ["--bc-tick-op" as string]: finalOpacity,
              } as React.CSSProperties)
        }
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={tickColor}
        strokeWidth={isHour ? 2 : 1}
        strokeLinecap="round"
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
