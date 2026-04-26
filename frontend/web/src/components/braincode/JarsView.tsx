import { Fragment } from "react";
import { BrainMascot } from "./BrainMascot";
import { JarSVG } from "./JarSVG";
import { CFG } from "./state";

interface Session {
  id: number;
  date: string;
  dur: string;
  score: number;
  label: string;
}

const MOCK_SESSIONS: Session[] = [
  { id: 1, date: "Hoy 10:30",  dur: "25m",    score: 88, label: "Análisis de datos" },
  { id: 2, date: "Hoy 09:00",  dur: "25m",    score: 62, label: "Revisión código" },
  { id: 3, date: "Ayer 16:45", dur: "1h 12m", score: 94, label: "Deep work" },
  { id: 4, date: "Ayer 14:00", dur: "25m",    score: 38, label: "Emails" },
  { id: 5, date: "Ayer 11:00", dur: "50m",    score: 76, label: "Prep reunión" },
  { id: 6, date: "Lun 17:00",  dur: "25m",    score: 95, label: "Arquitectura" },
  { id: 7, date: "Lun 15:00",  dur: "25m",    score: 55, label: "Revisión PRs" },
  { id: 8, date: "Lun 11:30",  dur: "1h 02m", score: 83, label: "Diseño sistema" },
];

function JarItem({ session }: { session: Session }) {
  const c = session.score >= 80 ? CFG.working.hex : session.score >= 58 ? CFG.social.hex : CFG.away.hex;
  return (
    <div className="bc-jar-item" title={`${session.label} · ${session.date} · ${session.dur}`}>
      <div className="bc-jar-svg-wrap">
        <JarSVG color={c} fillPct={session.score / 100} />
        <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", flexShrink: 0 }}>
          <BrainMascot size={56} color={c} />
        </div>
      </div>
      <div className="bc-jar-item-label">{session.label}</div>
      <div className="bc-jar-item-meta">
        <span className="bc-jar-item-score" style={{ color: c }}>{session.score}%</span>
      </div>
      <div className="bc-jar-item-date">{session.date}</div>
    </div>
  );
}

export function JarsView() {
  const rows = [MOCK_SESSIONS.slice(0, 4), MOCK_SESSIONS.slice(4)];
  return (
    <div className="bc-jars-view">
      <div className="bc-shelf-header">
        <div className="bc-mhdr-title" style={{ fontSize: 16 }}>Tarros de sesión</div>
        <div className="bc-mhdr-sub">{MOCK_SESSIONS.length} sesiones · El nivel indica el porcentaje de foco</div>
      </div>
      {rows.map((row, ri) => (
        <Fragment key={ri}>
          <div className="bc-shelf-row">
            {row.map((s) => <JarItem key={s.id} session={s} />)}
          </div>
          <div className="bc-shelf-spacer" />
        </Fragment>
      ))}
    </div>
  );
}
