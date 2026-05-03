# Plan: panel de stats final, animación de bote y tarros por día

## Context

Hoy en `frontend/web` (app de escritorio pywebview):

- Al terminar una sesión, `MonitorView` corre la secuencia `celebrate → insight → breakdown → cta` (`MonitorView.tsx:106-121`) pero **no muestra las stats totales** que ya devuelve `api.stop_session()` (`final_score`, `total_focused_time`, `segments_seconds`, `longest_focus_streak`).
- La pestaña Jars (`JarsView.tsx`) usa `MOCK_SESSIONS` y muestra **un tarro por sesión**.
- **No hay persistencia de sesiones individuales.** SQLite (`backend/database.py`) sólo guarda `window_metrics` y `cv_metrics`. `Api.stop_session` (`frontend/app.py:149`) devuelve stats pero no inserta nada.
- Al pulsar la `X` o "Otra vez" se hace `handleReset` y la pantalla vuelve a idle al instante, sin transición.

Decisiones del usuario:
- **Persistencia**: SQLite (no localStorage — es desktop app).
- **Trigger del bote**: tanto en "Otra vez" tras completar como en la `X` durante la sesión.
- **Overflow de cerebros en tarro**: reescalar todos uniformemente para que quepan.
- **Panel final**: todas las métricas + tiempo de cada uno de los 4 estados.

## Goal

1. Persistir cada sesión en SQLite y exponerla al frontend.
2. Renderizar un panel con las stats totales al terminar la sesión.
3. Animar un bote que se lleva al cerebro flotando antes del reset.
4. Reescribir Jars: un tarro por día, con un cerebro por sesión escalado por duración.

## Orden de implementación

1. Backend (tabla + endpoints) — base de A, B y C.
2. Cambio A — panel de stats final.
3. Cambio C — Jars por día consumiendo el endpoint nuevo.
4. Cambio B — animación de bote (independiente, capa visual sobre `handleReset`).

---

## 0. Backend: persistencia de sesiones

### `backend/database.py`

- Añadir en `init_db()` la tabla:
  ```sql
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at DATETIME NOT NULL,
    ended_at DATETIME NOT NULL,
    duration_sec INTEGER NOT NULL,
    mode TEXT NOT NULL,                 -- 'pomodoro' | 'freeflow'
    score INTEGER NOT NULL,
    longest_streak_sec INTEGER NOT NULL,
    working_sec INTEGER NOT NULL,
    away_sec INTEGER NOT NULL,
    social_sec INTEGER NOT NULL,
    absent_sec INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
  ```
- Función nueva `insert_session(record: dict) -> int`.
- Función nueva `list_sessions(since_iso: str | None = None) -> list[dict]`.

### `frontend/app.py`

- `Api.start_session` (línea 131): guardar `self._session_started_at = datetime.now()` y `self._session_mode` (recibirlo como segundo arg opcional desde JS, default `'freeflow'`).
- `Api.stop_session` (línea 149): tras llamar a `self._tracker.stop_session()`, construir el dict de sesión a partir de los stats devueltos + timestamps + mode, llamar `database.insert_session(...)`, y devolver el mismo payload de stats al frontend (sin romper contrato).
- Endpoint nuevo `Api.list_sessions(since_iso=None)` que llama a `database.list_sessions`.

### Frontend bridge

- `mock-api.ts`: añadir `list_sessions()` que devuelva un array sintético con varias sesiones por día (para `npm run dev`).
- `hooks.ts`: nuevo hook `useSessions()` que llama `api.list_sessions()` al montar y refresca al volver a foco (`visibilitychange`) — patrón parecido a `useBackendData`.
- `state.ts` o nuevo `sessionTypes.ts`: tipo `SessionRecord` con los mismos campos que la tabla SQL.

---

## A. Panel de stats final

### `MonitorView.tsx`

- Añadir `lastStatsRef = useRef<SessionRecord | null>(null)`.
- En el `useEffect` de orquestación de beats (líneas 107-121): cuando `pom.completed` pasa a `true`, capturar el resultado de `ctrl.stopSession()` en `lastStatsRef.current` (este es el momento natural — coincide con el `INSERT` del backend). Guard para no llamarlo dos veces si luego se pulsa "Otra vez".
- Modificar `handleReset` (líneas 76-81): si `lastStatsRef.current` ya existe, **no** volver a llamar `ctrl.stopSession()`. Si la sesión termina con `X` antes de completar, sí lo llama (y captura).
- En el bloque `bc-done-stack` (líneas 193-203), tras la leyenda añadir `<SessionTotals stats={lastStatsRef.current} />`, gateado a `completedBeat === "breakdown" || completedBeat === "cta"`.

### `src/components/braincode/SessionTotals.tsx` (nuevo)

Componente presentacional. Layout en grid:

- Encabezado: score % (grande) + duración total (mm:ss).
- Sub‑bloque "racha más larga": `longest_streak_sec` en mm:ss.
- 4 celdas con icono de color (`CFG[state].hex`) — una por estado:
  - Trabajando, Distraído (away), Social, Ausente — cada una con su tiempo en mm:ss y barra fina relativa al total.

### `index.css`

Clases nuevas con prefijo `bc-`: `.bc-done-totals`, `.bc-done-totals-grid`, `.bc-done-totals-cell`, `.bc-done-totals-num`, `.bc-done-totals-lbl`, `.bc-done-totals-bar`. Reveal animation con `animation-delay` 200ms tras `.bc-done-legend` reutilizando keyframes `bc-fade-up` ya existentes. Respetar `prefers-reduced-motion`.

---

## B. Animación de bote (farewell)

### `MonitorView.tsx`

- Estado nuevo `const [farewell, setFarewell] = useState(false)`.
- Helper `handleFinalize`:
  - Si `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → `handleReset()` directo.
  - Si no → `setFarewell(true)` y al recibir `onAnimationEnd` del bote (o tras `2200ms` como fallback) llamar `handleReset()` y `setFarewell(false)`.
- Conectar a `handleFinalize`:
  - Botón "Otra vez" (línea 231) — flujo post‑completado.
  - Botón `X` "Terminar sesión" (línea 259) — terminación temprana.
- Añadir clase `farewell` al root: `bc-monitor${... farewell ? " farewell" : ""}`.
- Renderizar `<BoatFarewell active={farewell} onDone={handleReset} />` como hermano de los toasts.

### `src/components/braincode/BoatSVG.tsx` (nuevo)

SVG inline pequeño (casco, vela, mástil). Sin props complejas (`size?: number`).

### `src/components/braincode/BoatFarewell.tsx` (nuevo)

Overlay `position: absolute; inset: 0; pointer-events: none`. Renderiza `BoatSVG` dentro de `.bc-boat`, con `.bc-boat-wave` decorativa debajo. Expone `onDone` que se dispara con `onAnimationEnd` del bote.

### `index.css`

Keyframes nuevos:
- `bc-boat-sail`: el bote entra desde la derecha hacia el centro y luego sale por la izquierda.
- `bc-brain-hop`: el cerebro flotante hace un pequeño salto y traslada hasta la cubierta del bote.
- `bc-wave-bob`: ondulación de la línea de agua.

Selectores:
- `.bc-monitor.farewell .bc-brain-float` — corre `bc-brain-hop`, fade a 0 al final.
- `.bc-farewell-overlay`, `.bc-boat`, `.bc-boat-svg`, `.bc-boat-wave`.
- `@media (prefers-reduced-motion: reduce)` — overlay oculto y animaciones a `none`.

Color del bote: tono madera neutro o `--bc-amber` para sintonizar con la paleta cálida.

---

## C. Jars: un tarro por día

### `JarsView.tsx` (reescritura del cuerpo)

- Eliminar `MOCK_SESSIONS` y el componente `JarItem`.
- Usar nuevo hook `useSessions()` para obtener `SessionRecord[]`.
- Agrupar por día: `groupByDay(sessions)` → `Map<isoDate, SessionRecord[]>` ordenado descendente por fecha (hoy primero).
- Componente `DayJar` (reemplaza a `JarItem`) con props `{ isoDate, sessions }`:
  - `avgScore = mean(sessions.score)` → determina color (mismas thresholds: ≥80 working, ≥58 social, <58 away).
  - `<JarSVG color={c} fillPct={avgScore/100} />`.
  - **Layout interno de cerebros (escala uniforme para que quepan):**
    - Tamaño base por duración: `base = clamp(24, 24 + (durationMin - 5) * (40/85), 64)` (5 min → 24px, 90 min → 64px).
    - Espacio disponible dentro del tarro (zona del líquido) ≈ ancho 60px.
    - Si `sum(base) > capacidad`, calcular `factor = capacidad / sum(base)` y aplicar a todos: `size = round(base * factor)`. Mínimo absoluto 14px.
    - Renderizar los cerebros en una fila/columna con `flex-wrap`, ordenados por duración descendente, contenedor `.bc-jar-brain-stack` posicionado absoluto en la zona del líquido del tarro.
  - Etiqueta de fecha bajo el tarro: "Hoy", "Ayer" o `lun 28` (formato corto localizado).
  - Tooltip en `title`: `${sessions.length} sesiones · ${totalFocusMin} min foco · ${avgScore}%`.
- Estanteria: chunk de los días en filas de 4 (igual que ahora), `.bc-shelf-row`.
- Header: actualizar texto a "X días · Y sesiones".

### `index.css`

Nuevas clases: `.bc-jar-brain-stack`, `.bc-jar-brain-slot`, `.bc-jar-day-count`. La pila de cerebros vive dentro de `.bc-jar-svg-wrap` con `position: absolute; bottom: <depende del fillPct>`.

---

## Archivos críticos a modificar

- `C:\proyectos\Vibehackers\BrainCODE\backend\database.py` — tabla `sessions`, helpers.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\app.py` — `Api.stop_session` con `INSERT`, nuevo `Api.list_sessions`.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\hooks.ts` — `useSessions`.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\mock-api.ts` — `list_sessions` mock.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\MonitorView.tsx` — captura de stats, `farewell`, integración de `SessionTotals` y `BoatFarewell`.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\JarsView.tsx` — reescritura.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\index.css` — clases y keyframes.

## Archivos nuevos

- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\SessionTotals.tsx`.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\BoatSVG.tsx`.
- `C:\proyectos\Vibehackers\BrainCODE\frontend\web\src\components\braincode\BoatFarewell.tsx`.

## Componentes/utilidades existentes a reutilizar

- `BrainMascot` (`BrainMascot.tsx`) — para los cerebros dentro de cada tarro, con `state="completed"`.
- `JarSVG` (`JarSVG.tsx`) — la base del tarro.
- `Sparkles` (`Sparkles.tsx`) — ya en uso al completar.
- `CFG` y `STATES` (`state.ts`) — colores y labels de los 4 estados para el panel de totales.
- Keyframes existentes (`bc-fade-up`, `bc-float`, `bc-tab-in`) y variables `--dur-*`, `--ease-*` (`index.css`).

## Verificación

1. **Backend**:
   - `python -c "from backend.database import init_db; init_db()"` — confirma que la tabla `sessions` se crea.
   - `python -m backend.demo` o el flujo equivalente: tras un `stop_session()`, comprobar con `sqlite3 metrics.db "SELECT * FROM sessions ORDER BY id DESC LIMIT 1;"` que se insertó la fila con duración, score y los 4 *_sec correctos.

2. **Frontend dev (mock)**:
   - `cd frontend/web && npm run dev`.
   - Abrir Jars → verificar que los días aparecen agrupados con varios cerebros por tarro y los tamaños cambian con la duración.
   - Disparar una sesión rápida en modo freeflow → al pulsar `X` debe aparecer el bote ~2s antes de volver a idle.
   - Completar un pomodoro corto (1 min × 1) → en `breakdown` debe aparecer el panel `SessionTotals` con los 4 estados y barras; al pulsar "Otra vez" debe disparar el bote.

3. **App empaquetada**:
   - Lanzar `python frontend/app.py`.
   - Hacer 2-3 sesiones reales → reabrir la app y comprobar que aparecen en Jars (persistencia SQLite real, no localStorage).
   - Cambiar la fecha del sistema o usar SQL directo (`UPDATE sessions SET started_at = ...`) para validar que jars de "Ayer"/días previos se renderizan correctamente.

4. **Accesibilidad**:
   - Activar "reduce motion" del SO → confirmar que el bote no aparece y `handleReset` es instantáneo.
