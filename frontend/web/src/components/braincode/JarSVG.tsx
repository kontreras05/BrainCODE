interface JarSVGProps {
  color: string;
  fillPct: number;
}

export function JarSVG({ color, fillPct }: JarSVGProps) {
  const W = 80, H = 100, bY = 20, bH = H - 28;
  const fH = bH * fillPct;
  const fY = bY + bH - fH;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} fill="none" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>
      <rect x="6" y={bY} width={W - 12} height={bH} rx="10" fill="oklch(99.5% 0.004 60)" stroke="var(--bc-border-2)" strokeWidth="1.5" />
      {fH > 3 && <rect x="7.5" y={fY} width={W - 15} height={fH} rx="7" fill={color} opacity="0.15" />}
      {fH > 3 && <rect x="7.5" y={fY} width={W - 15} height="5" rx="2.5" fill={color} opacity="0.48" />}
      <rect x="11" y={bY + 5} width="5" height={bH - 10} rx="2.5" fill="white" opacity="0.38" />
      <rect x="13" y="11" width={W - 26} height="13" rx="5" fill="var(--bc-surface-2)" stroke="var(--bc-border)" strokeWidth="1.2" />
      <rect x="11" y="2" width={W - 22} height="11" rx="4" fill={color} opacity="0.28" stroke={color} strokeWidth="1" strokeOpacity="0.45" />
    </svg>
  );
}
