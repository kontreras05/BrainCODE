import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 64;      // distancia (px) a partir de la cual se dispara la recarga
const MAX_PULL = 96;       // tope del arrastre visual
const RESISTANCE = 0.5;    // el contenido sigue al gesto a media velocidad
const MIN_SPIN_MS = 480;   // el spinner se ve aunque el backend responda al instante
const WHEEL_IDLE_MS = 140; // sin más eventos de rueda ⇒ el gesto terminó

type Phase = "idle" | "pulling" | "refreshing";

interface PullToRefreshProps {
  /** Clase del contenedor scrollable (p.ej. "bc-metrics"), conserva su layout. */
  className: string;
  onRefresh: () => void | Promise<unknown>;
  children: ReactNode;
}

/**
 * Envuelve un contenedor scrollable y añade "deslizar hacia abajo para recargar".
 * Responde a rueda/trackpad y a gestos táctiles, siempre que el scroll esté arriba
 * del todo. La recarga sólo se dispara al soltar habiendo superado THRESHOLD.
 */
export function PullToRefresh({ className, onRefresh, children }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const phaseRef = useRef<Phase>("idle");
  const pullRef = useRef(0);
  const distRef = useRef(0);        // distancia bruta acumulada del gesto
  const touchStartY = useRef<number | null>(null);
  const wheelTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
    };
  }, []);

  const setPhaseSafe = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const setPullSafe = (v: number) => { pullRef.current = v; setPull(v); };

  const atTop = () => (scrollRef.current?.scrollTop ?? 1) <= 0;

  const applyDistance = useCallback((dist: number) => {
    distRef.current = Math.max(0, dist);
    setPullSafe(Math.min(MAX_PULL, distRef.current * RESISTANCE));
    setPhaseSafe(distRef.current > 0 ? "pulling" : "idle");
  }, []);

  const release = useCallback(async () => {
    const reached = distRef.current * RESISTANCE >= THRESHOLD;
    distRef.current = 0;
    touchStartY.current = null;

    if (!reached) {
      setPullSafe(0);
      setPhaseSafe("idle");
      return;
    }

    setPhaseSafe("refreshing");
    setPullSafe(THRESHOLD);
    try {
      await Promise.all([
        Promise.resolve(onRefresh()),
        new Promise((r) => window.setTimeout(r, MIN_SPIN_MS)),
      ]);
    } catch (err) {
      console.warn("[PullToRefresh] error al recargar", err);
    }
    if (!mounted.current) return;
    setPullSafe(0);
    setPhaseSafe("idle");
  }, [onRefresh]);

  // Rueda / trackpad: sólo cuenta el desplazamiento hacia abajo estando arriba del todo.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (phaseRef.current === "refreshing") return;
    if (e.deltaY >= 0 || !atTop()) {
      if (distRef.current > 0) applyDistance(0);
      return;
    }
    applyDistance(distRef.current + Math.abs(e.deltaY));
    if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => { void release(); }, WHEEL_IDLE_MS);
  }, [applyDistance, release]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (phaseRef.current === "refreshing" || !atTop()) return;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy <= 0) { applyDistance(0); return; }
    applyDistance(dy);
  }, [applyDistance]);

  const onTouchEnd = useCallback(() => {
    if (touchStartY.current === null) return;
    void release();
  }, [release]);

  const progress = Math.min(1, pull / THRESHOLD);
  const ready = phase === "pulling" && progress >= 1;
  const refreshing = phase === "refreshing";

  return (
    <div className="bc-ptr">
      <div
        className={`bc-ptr-hint${refreshing ? " spinning" : ""}${ready ? " ready" : ""}`}
        style={{ opacity: progress, transform: `translate(-50%, ${pull - 28}px) scale(${0.7 + progress * 0.3})` }}
        aria-hidden={pull === 0}
      >
        <RefreshCw
          size={14}
          strokeWidth={1.8}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
      <div
        ref={scrollRef}
        className={className}
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: phase === "pulling" ? "none" : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
