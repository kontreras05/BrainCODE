import { useEffect, useRef, useState } from "react";
import { STATES, type BCState, type SessionConfig } from "./state";

export function pyApi(): any {
  // @ts-ignore
  return (typeof window !== 'undefined' && window.pywebview && window.pywebview.api) || null;
}

export function waitForPyApi(timeoutMs = 3000): Promise<any> {
  return new Promise(resolve => {
    if (pyApi()) return resolve(pyApi());
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (pyApi()) { clearInterval(iv); resolve(pyApi()); }
      else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); resolve(null); }
    }, 100);
  });
}

export function useBackendData() {
  const [metrics, setMetrics] = useState<any>(null);
  const [hourly, setHourly] = useState<any[]>([]);
  const [score, setScore] = useState({ pct: 0, mins: 0 });

  useEffect(() => {
    let alive = true;
    async function load() {
      const api = await waitForPyApi();
      if (!api || !alive) return;
      try {
        const today = await api.get_today_metrics();
        if (alive && today && today.has_data) {
          setMetrics(today);
          setScore({ pct: today.score_pct, mins: today.active_minutes });
        }
        const hb = await api.get_hourly_breakdown();
        if (alive && hb && hb.length) {
          setHourly(hb);
        }
      } catch (err) {
        console.warn('API error', err);
      }
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return { metrics, hourly, score };
}

export function useSim(active: boolean) {
  const [state, setState] = useState<BCState>("working");
  const [segs, setSegs] = useState({ working: 0.62, away: 0.12, social: 0.09, absent: 0.05 });
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const next = STATES[Math.floor(Math.random() * STATES.length)];
      setState(next);
      window.dispatchEvent(new CustomEvent("bc-state", { detail: next }));
      setSegs((p) => ({ ...p, [next]: Math.min(p[next] + 0.005, 0.9) }));
    }, 7000);
    return () => clearInterval(t);
  }, [active]);
  return { state, segs };
}

export function usePomodoro() {
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [secs, setSecs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(0);
  const [completed, setCompleted] = useState(false);
  const doneRef = useRef(0);

  function start(cfg: SessionConfig) {
    setConfig(cfg);
    setIsBreak(false);
    setDone(0);
    doneRef.current = 0;
    setCompleted(false);
    setElapsed(0);
    setSecs(cfg.mode === "pomodoro" ? cfg.workMin * 60 : 0);
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setConfig(null);
    setIsBreak(false);
    setSecs(0);
    setElapsed(0);
    setDone(0);
    doneRef.current = 0;
    setCompleted(false);
  }

  useEffect(() => {
    if (!running || !config) return;
    if (config.mode === "freeflow") {
      const t = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(t);
    }
    const cfg = config;
    const t = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          if (!isBreak) {
            const nd = doneRef.current + 1;
            doneRef.current = nd;
            setDone(nd);
            if (cfg.totalPoms && nd >= cfg.totalPoms) {
              setRunning(false);
              setCompleted(true);
              return 0;
            }
            setIsBreak(true);
            return cfg.breakMin * 60;
          } else {
            setIsBreak(false);
            return cfg.workMin * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, isBreak, config]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function skip() {
    if (!config || config.mode !== "pomodoro") return;
    if (isBreak) {
      setIsBreak(false);
      setSecs(config.workMin * 60);
    } else {
      const nd = doneRef.current + 1;
      doneRef.current = nd;
      setDone(nd);
      if (config.totalPoms && nd >= config.totalPoms) {
        setRunning(false);
        setCompleted(true);
        return;
      }
      setIsBreak(true);
      setSecs(config.breakMin * 60);
    }
  }

  return { config, running, setRunning, isBreak, secs, elapsed, fmt, done, skip, start, reset, completed };
}
