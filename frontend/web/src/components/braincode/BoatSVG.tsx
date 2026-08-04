export function BoatSVG({ size = 96 }: { size?: number }) {
  const h = Math.round(size * 0.7);
  return (
    <svg width={size} height={h} viewBox="0 0 100 70" fill="none">
      {/* Hull */}
      <path
        d="M10 38 Q50 54 90 38 L84 50 Q50 64 16 50 Z"
        fill="oklch(72% 0.10 65)"
        stroke="oklch(58% 0.10 55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Hull highlight */}
      <path
        d="M24 46 Q50 56 76 46"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.22"
      />
      {/* Mast */}
      <rect x="49" y="10" width="2.5" height="28" rx="1.2" fill="oklch(44% 0.06 55)" />
      {/* Sail */}
      <path
        d="M50 12 L50 37 L20 29 Z"
        fill="oklch(98% 0.012 60)"
        stroke="oklch(82% 0.02 62)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sail crease */}
      <path d="M50 18 L30 28" stroke="oklch(88% 0.015 60)" strokeWidth="0.8" opacity="0.6" />
      {/* Flag */}
      <path
        d="M51 10 L64 14 L51 19 Z"
        fill="oklch(57% 0.18 25)"
        opacity="0.9"
      />
    </svg>
  );
}
