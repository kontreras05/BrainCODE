import { CFG, STATES } from "./state";

interface SessionStats {
  final_score?: number;
  longest_focus_streak?: number;
  segments_seconds?: { working?: number; away?: number; social?: number; absent?: number };
}

function fmt(secs: number): string {
  const s = Math.round(Math.max(0, secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SessionTotals({ stats }: { stats: SessionStats | null }) {
  // Always render — fall back to zeros if the backend didn't return data.
  // Returning null here was masking real layout/data issues post-completion.
  const final_score = Math.round(stats?.final_score ?? 0);
  const longest_focus_streak = stats?.longest_focus_streak ?? 0;
  const rawSegs = stats?.segments_seconds ?? {};
  const segs = {
    working: rawSegs.working ?? 0,
    away: rawSegs.away ?? 0,
    social: rawSegs.social ?? 0,
    absent: rawSegs.absent ?? 0,
  };
  const totalSec = segs.working + segs.away + segs.social + segs.absent;

  return (
    <div className="bc-done-totals">
      <div className="bc-done-totals-header">
        <div className="bc-done-totals-metric bc-done-totals-metric--lead">
          <span className="bc-done-totals-key">Foco</span>
          <span className="bc-done-totals-score">{final_score}%</span>
        </div>
        <div className="bc-done-totals-metric">
          <span className="bc-done-totals-key">Total</span>
          <span className="bc-done-totals-mono">{fmt(totalSec)}</span>
        </div>
        <div className="bc-done-totals-metric">
          <span className="bc-done-totals-key">Racha</span>
          <span className="bc-done-totals-mono">{fmt(longest_focus_streak)}</span>
        </div>
      </div>
      <ul className="bc-done-totals-list">
        {STATES.map((s, i) => {
          const sec = segs[s];
          const pct = totalSec > 0 ? sec / totalSec : 0;
          const c = CFG[s];
          return (
            <li
              key={s}
              className="bc-done-totals-row"
              style={{ animationDelay: `${0.18 + i * 0.08}s` }}
            >
              <span className="bc-done-totals-rdot" style={{ background: c.hex }} />
              <span className="bc-done-totals-rlbl">{c.label}</span>
              <span className="bc-done-totals-rbar" aria-hidden>
                <span
                  className="bc-done-totals-rfill"
                  style={{ width: `${Math.round(pct * 100)}%`, background: c.hex }}
                />
              </span>
              <span className="bc-done-totals-rtime">{fmt(sec)}</span>
              <span className="bc-done-totals-rpct">{Math.round(pct * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
