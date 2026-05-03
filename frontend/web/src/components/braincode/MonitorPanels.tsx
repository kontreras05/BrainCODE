import { useMemo } from "react";
import { CFG, STATES, type SessionRecord } from "./state";

function fmtMin(secs: number): string {
  if (secs <= 0) return "0 min";
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function computeStreak(sessions: SessionRecord[], now: Date): number {
  if (!sessions.length) return 0;
  const days = new Set<number>();
  for (const s of sessions) {
    const t = Date.parse(s.ended_at);
    if (!Number.isNaN(t)) days.add(startOfDay(new Date(t)));
  }
  let streak = 0;
  let cursor = startOfDay(now);
  if (!days.has(cursor)) cursor -= 86400000;
  while (days.has(cursor)) {
    streak++;
    cursor -= 86400000;
  }
  return streak;
}

interface LeftProps {
  idle: boolean;
  isPending: boolean;
  isFreeflow: boolean;
  pomDone: number;
  pomTotal: number;
  isBreak: boolean;
  sessions: SessionRecord[];
  todayMins: number;
}

export function MonitorPanelLeft({
  idle,
  isPending,
  isFreeflow,
  pomDone,
  pomTotal,
  isBreak,
  sessions,
  todayMins,
}: LeftProps) {
  if (isPending) return null;

  const now = useMemo(() => new Date(), []);
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86400000;

  const yesterdaysSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const t = Date.parse(s.ended_at);
        return !Number.isNaN(t) && t >= yesterdayStart && t < todayStart;
      }),
    [sessions, todayStart, yesterdayStart],
  );

  const ydSec = yesterdaysSessions.reduce((a, s) => a + s.duration_sec, 0);
  const ydScore = yesterdaysSessions.length
    ? Math.round(
        yesterdaysSessions.reduce((a, s) => a + s.score, 0) / yesterdaysSessions.length,
      )
    : 0;

  const todaysSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const t = Date.parse(s.ended_at);
        return !Number.isNaN(t) && t >= todayStart;
      }),
    [sessions, todayStart],
  );
  const todayFromSessionsMin =
    todaysSessions.reduce((a, s) => a + s.duration_sec, 0) / 60;
  const todayDisplayMin = todayMins > 0 ? todayMins : todayFromSessionsMin;

  const streak = computeStreak(sessions, now);

  if (idle) {
    return (
      <aside className="bc-side bc-side-l" aria-label="Tu historial">
        <div className="bc-side-block">
          <div className="bc-side-label">Ayer</div>
          {yesterdaysSessions.length > 0 ? (
            <>
              <div className="bc-side-value">{fmtMin(ydSec)}</div>
              <div className="bc-side-meta">
                {ydScore}% enfocado · {yesterdaysSessions.length}{" "}
                {yesterdaysSessions.length === 1 ? "sesión" : "sesiones"}
              </div>
            </>
          ) : (
            <div className="bc-side-meta">Sin sesiones aún</div>
          )}
        </div>
        {streak > 0 && (
          <div className="bc-side-block">
            <div className="bc-side-label">Racha</div>
            <div className="bc-side-value">
              {streak}
              <span className="bc-side-unit">{streak === 1 ? "día" : "días"}</span>
            </div>
            <div className="bc-side-meta">no la rompas hoy</div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="bc-side bc-side-l" aria-label="Sesión actual">
      <div className="bc-side-block">
        <div className="bc-side-label">
          {isFreeflow ? "Modo libre" : isBreak ? "Descanso" : "Pomodoro"}
        </div>
        {!isFreeflow ? (
          <>
            <div className="bc-side-value">
              {Math.min(pomDone + (isBreak ? 0 : 1), pomTotal)}
              <span className="bc-side-unit">de {pomTotal}</span>
            </div>
            <div className="bc-side-meta">
              {isBreak ? "tómate un respiro" : "manténlo"}
            </div>
          </>
        ) : (
          <div className="bc-side-meta">tiempo abierto</div>
        )}
      </div>
      {todayDisplayMin > 0 && (
        <div className="bc-side-block">
          <div className="bc-side-label">Hoy</div>
          <div className="bc-side-value">{fmtMin(todayDisplayMin * 60)}</div>
          <div className="bc-side-meta">acumulado</div>
        </div>
      )}
      {streak > 0 && (
        <div className="bc-side-block">
          <div className="bc-side-label">Racha</div>
          <div className="bc-side-value">
            {streak}
            <span className="bc-side-unit">{streak === 1 ? "día" : "días"}</span>
          </div>
        </div>
      )}
    </aside>
  );
}

interface RightProps {
  idle: boolean;
  completed: boolean;
  isPending: boolean;
  isBreak: boolean;
  segSecs: { working: number; away: number; social: number; absent: number };
  envHint: string | null;
}

export function MonitorPanelRight({
  idle,
  completed,
  isPending,
  isBreak,
  segSecs,
  envHint,
}: RightProps) {
  if (idle || completed || isPending || isBreak) return null;

  const total =
    segSecs.working + segSecs.away + segSecs.social + segSecs.absent;

  return (
    <aside className="bc-side bc-side-r" aria-label="Estado en vivo">
      <div className="bc-side-block">
        <div className="bc-side-label">En esta sesión</div>
        <div className="bc-side-statelist">
          {STATES.map((s) => {
            const sec = segSecs[s];
            const pct = total > 0 ? Math.round((sec / total) * 100) : 0;
            return (
              <div key={s} className="bc-side-stateitem">
                <span
                  className="bc-side-statedot"
                  style={{ background: CFG[s].hex }}
                />
                <span className="bc-side-statelbl">{CFG[s].label}</span>
                <span className="bc-side-statetime">{fmtClock(sec)}</span>
                <span className="bc-side-statepct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      {envHint && (
        <div className="bc-side-block bc-side-hint">
          <div className="bc-side-label">Aviso</div>
          <div className="bc-side-meta">{envHint}</div>
        </div>
      )}
    </aside>
  );
}
