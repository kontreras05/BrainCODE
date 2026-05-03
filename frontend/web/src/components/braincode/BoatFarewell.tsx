import { BoatSVG } from "./BoatSVG";

interface BoatFarewellProps {
  active: boolean;
  onDone: () => void;
}

export function BoatFarewell({ active, onDone }: BoatFarewellProps) {
  if (!active) return null;

  function handleAnimEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onDone();
  }

  return (
    <div className="bc-farewell-overlay" aria-hidden>
      <div className="bc-boat-wave" />
      <div className="bc-boat" onAnimationEnd={handleAnimEnd}>
        <BoatSVG size={96} />
      </div>
    </div>
  );
}
