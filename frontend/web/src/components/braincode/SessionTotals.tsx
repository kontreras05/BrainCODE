import { CFG, STATES } from "./state";

interface SessionStats {
  final_score: number;
  longest_focus_streak: number;
  segments_seconds: { working: number; away: number; social: number; absent: number };
}

function fmt(secs: number): string {
  const s = Math.round(Math.max(0, secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SessionTotals({ stats }: { stats: SessionStats | null }) {
  if (!stats) return null;

  const { final_score, longest_focus_streak, segments_seconds: segs } = stats;
  const totalSec = segs.working + segs.away + segs.social + segs.absent;

  return (
    <div className="bc-done-totals">
      <div className="bc-done-totals-header">
        <span className="bc-done-totals-score">{final_score}%</span>
        <span className="bc-done-totals-duration">{fmt(totalSec)}</span>
      </div>
      <div className="bc-done-totals-streak">
        Racha más larga: <strong>{fmt(longest_focus_streak)}</strong>
      </div>
      <div className="bc-done-totals-grid">
        {STATES.map((s) => {
          const sec = segs[s];
          const pct = totalSec > 0 ? sec / totalSec : 0;
          const c = CFG[s];
          return (
            <div key={s} className="bc-done-totals-cell">
              <div className="bc-done-totals-cell-top">
                <span className="bc-done-totals-dot" style={{ background: c.hex }} />
                <span className="bc-done-totals-lbl">{c.label}</span>
              </div>
              <div className="bc-done-totals-num">{fmt(sec)}</div>
              <div className="bc-done-totals-bar">
                <div
                  className="bc-done-totals-bar-fill"
                  style={{ width: `${Math.round(pct * 100)}%`, background: c.hex }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
