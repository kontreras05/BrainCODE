import { Fragment, useMemo } from "react";
import { BrainMascot } from "./BrainMascot";
import { JarSVG } from "./JarSVG";
import { CFG, type SessionRecord } from "./state";
import { useSessions } from "./hooks";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(isoDate: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === localDateStr(today)) return "Hoy";
  if (isoDate === localDateStr(yesterday)) return "Ayer";
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "");
}

function groupByDay(sessions: SessionRecord[]): Map<string, SessionRecord[]> {
  const map = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

function brainSizes(sessions: SessionRecord[]): number[] {
  const CAPACITY = 60;
  const bases = sessions.map((s) => {
    const dMin = s.duration_sec / 60;
    return Math.min(64, Math.max(24, 24 + (dMin - 5) * (40 / 85)));
  });
  const total = bases.reduce((a, b) => a + b, 0);
  if (total <= CAPACITY) return bases.map(Math.round);
  const factor = CAPACITY / total;
  return bases.map((b) => Math.max(14, Math.round(b * factor)));
}

function DayJar({ isoDate, sessions }: { isoDate: string; sessions: SessionRecord[] }) {
  const avgScore = Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length);
  const c = avgScore >= 80 ? CFG.working.hex : avgScore >= 58 ? CFG.social.hex : CFG.away.hex;
  const totalFocusMin = Math.round(sessions.reduce((a, s) => a + s.working_sec, 0) / 60);
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.duration_sec - a.duration_sec),
    [sessions]
  );
  const sizes = useMemo(() => brainSizes(sorted), [sorted]);

  return (
    <div
      className="bc-jar-item"
      title={`${sessions.length} sesión${sessions.length !== 1 ? "es" : ""} · ${totalFocusMin} min foco · ${avgScore}%`}
    >
      <div className="bc-jar-svg-wrap">
        <JarSVG color={c} fillPct={avgScore / 100} />
        <div className="bc-jar-brain-stack">
          {sorted.map((s, i) => (
            <div key={s.id} className="bc-jar-brain-slot">
              <BrainMascot size={sizes[i]} color={c} state="completed" />
            </div>
          ))}
        </div>
      </div>
      <div className="bc-jar-item-date">{dayLabel(isoDate)}</div>
      <div className="bc-jar-day-count">
        {sessions.length} ses. · {avgScore}%
      </div>
    </div>
  );
}

export function JarsView() {
  const sessions = useSessions();
  const dayMap = useMemo(() => groupByDay(sessions), [sessions]);
  const days = [...dayMap.entries()];

  const rows: [string, SessionRecord[]][][] = [];
  for (let i = 0; i < days.length; i += 4) rows.push(days.slice(i, i + 4));

  return (
    <div className="bc-jars-view">
      <div className="bc-shelf-header">
        <div className="bc-mhdr-title" style={{ fontSize: 16 }}>Tarros de sesión</div>
        <div className="bc-mhdr-sub">
          {days.length} {days.length === 1 ? "día" : "días"} · {sessions.length}{" "}
          {sessions.length === 1 ? "sesión" : "sesiones"}
        </div>
      </div>
      {sessions.length === 0 ? (
        <div className="bc-settings-empty">No hay sesiones todavía</div>
      ) : (
        rows.map((row, ri) => (
          <Fragment key={ri}>
            <div className="bc-shelf-row">
              {row.map(([isoDate, daySessions]) => (
                <DayJar key={isoDate} isoDate={isoDate} sessions={daySessions} />
              ))}
            </div>
            <div className="bc-shelf-spacer" />
          </Fragment>
        ))
      )}
    </div>
  );
}
