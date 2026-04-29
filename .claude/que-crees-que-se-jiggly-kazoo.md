# Rediseño de la pantalla principal — Plan de implementación

## Contexto

BrainCODE (pywebview + React) tiene una pantalla principal (`MonitorView.tsx`) que combina timer Pomodoro/Libre y mascota cerebral live. El stack es sólido (paleta OKLCH, tipografía, motion tokens, `prefers-reduced-motion`), pero la experiencia se siente "plantilla genérica" porque:

1. **Hay demasiados focos de atención simultáneos** durante la sesión activa (anillo de 4 colores + mascota + timer + chip + 8 puntos + contador). Sin protagonista único.
2. **El inicio no compromete** (dos botones equivalentes + 3 inputs numéricos), y la calibración se siente como trámite y no como ritual.
3. **El cierre no es memorable** (4 porcentajes y un botón; pico-final desperdiciado).
4. **Falta voz, anclaje temporal y respiración del producto** (copy funcional, idle frío, ambient estático).

Este plan ataca cuatro áreas validadas con el usuario: **A2** (limpiar jerarquía), **A3** (ritual de inicio), **A4** (cierre pico-final), y **C** (quick wins de polish premium). Quedan fuera (para una segunda ronda): rediseño completo de la mascota como personaje (A1), modo descanso como otra habitación (B2), sistema de progresión persistente (B1).

---

## Principios rectores

1. **Un protagonista por momento.** Idle: la mascota invita. Activo: el timer manda. Cierre: la insight celebra.
2. **Confiar en el visual, recortar el texto.** Si la mascota dice "distraído", quita el chip.
3. **Pico-final.** El final es el momento más memorable de la app: 1 insight personalizada > 4 porcentajes.
4. **Cada gesto es compromiso.** Un botón que dice "Empezar 25 min" pesa más que dos botones equivalentes.
5. **El producto respira.** El aura, la mascota y el timer tienen ritmo propio, no son estáticos.

---

## Fases de ejecución

Las fases son independientes y se pueden mergear por separado. Recomiendo este orden por ratio impacto/riesgo: **Fase 1 (A2 + C copy)** → **Fase 2 (A3 ritual)** → **Fase 3 (A4 cierre)** → **Fase 4 (resto de C)**.

---

### FASE 1 · Limpiar jerarquía + voz (A2 + C1 + C4)

**Objetivo**: la sesión activa pasa a tener un único protagonista (timer) con la mascota como compañero visual y el resto desvanecido.

#### 1.1 Anillo: un solo trazo durante la sesión, segmentado solo en el cierre
- **`Ring.tsx`** — añadir prop `mode: "live" | "summary"`. En `live`: render un único `<circle>` de progreso del pomodoro actual, color del estado actual (verde working / rojo away / ámbar social / gris absent), trazo limpio sin acumulación de segmentos. En `summary` (cierre): el comportamiento actual (4 segmentos por porcentaje).
- **`MonitorView.tsx:79-84, 102`** — calcular `mode` según `pom.completed`. El `pct` en modo live se deriva de `pom.secs` vs `pom.config.workMin*60` (o `pom.elapsed` para freeflow) más el estado actual `state`.

#### 1.2 Quitar el chip de estado redundante
- **`MonitorView.tsx:153-158`** — eliminar el bloque `bc-state-chip`. La mascota ya comunica el estado vía expresión + color del aura.
- Excepción: cuando el estado **acaba de cambiar** (<2.5s desde la última transición), mostrar un chip discreto que se autodesvanece. Implementación: `useState<{state: BCState, ts: number} | null>` que se setea en cada `bc-state` event (ya emitido por `useFocusTracker:138`).

#### 1.3 Quitar contador "2/4 · 25/5 min" inline
- **`MonitorView.tsx:200-207`** — quitar el `<span className="bc-pom-info">`. Los puntos ya cuentan el progreso. Mostrar el detalle solo en `:hover` del cluster `.bc-pom-dots` con un tooltip nativo (`title="2 de 4 pomodoros · 25/5 min"`) o un `<span>` que aparezca con `opacity` en hover vía CSS.

#### 1.4 Anclaje temporal en idle (C1)
- **`MonitorView.tsx:118-122`** — usar `useBackendData()` (ya existe en `hooks.ts:20`). Cuando `metrics.has_data`, sustituir "Sin sesión activa / Elige un modo" por un saludo contextual:
  - Hora-aware: "Buenos días, Fernando" / "Buenas tardes" / "Aún por aquí".
  - Una línea de dato útil debajo: "Llevas {active_minutes} min de foco hoy" o "{N} días de racha" si está disponible.
  - Si `!metrics.has_data` (primera sesión del día), un copy de bienvenida: "Listo cuando tú lo estés".
- El nombre del usuario hay que decidirlo: opciones (a) preguntarlo en un onboarding mínimo y persistir en localStorage; (b) leer del sistema operativo vía backend; (c) omitirlo en esta fase y usar solo "Buenos días". **Default propuesto**: (c) por simplicidad, dejar (a) para una fase posterior.

#### 1.5 Copy con voz (C4)
Archivos: `MonitorView.tsx`, `SessionSetup.tsx`, `CalibrationOverlay.tsx`.
Sustituciones (todas en strings inline, no hay i18n):
- "Sin sesión activa" → "Listo cuando tú lo estés"
- "Elige un modo para empezar" → eliminar (queda redundante con el botón)
- "Calibrando…" → "Vamos a centrarnos"
- "Sigue las instrucciones de la cámara" → "Mira al punto que aparece"
- "¡Sesión completada!" → "Sesión cerrada" (tono más sereno; el peso emocional lo lleva la insight, no el texto)
- "Nueva sesión" → "Otra vez"
- Botón "Pausar" → "Pausa"
- Botón "Continuar" → "Sigue"
- "Saltar" → mantener
- `aria-label="Terminar sesión"` → "Cerrar sesión"

#### 1.6 CSS — desvanecimientos suaves
- **`index.css:510-516`** — añadir keyframes para chip auto-dismiss: `bc-chip-fade` (opacity 1 → 0 en 800ms con 1.5s de delay).
- **`index.css:200-207`** zona `.bc-pom-dots` — añadir `:hover .bc-pom-info { opacity: 1 }` con transición.

**Verificación Fase 1**:
- Abrir la app, sin sesión: debe verse el saludo + un dato del día (si hay). Layout más limpio.
- Iniciar pomodoro: durante la sesión solo veo timer + mascota + anillo de un color + 4 puntos. Sin chip permanente, sin contador.
- Cambiar de estado (taparse la cara, abrir Twitter): aparece chip 1.5s y se desvanece.

---

### FASE 2 · Ritual de inicio (A3)

**Objetivo**: el inicio se siente como un compromiso, no como un click.

#### 2.1 Default inteligente + un solo botón primario
- **`SessionSetup.tsx`** — rediseñar el estado inicial:
  - Recordar la última config en `localStorage` (clave `bc:last-session`, JSON de `SessionConfig`). Si no existe, default `{mode:"pomodoro", workMin:25, breakMin:5, totalPoms:4}`.
  - Render principal: **un único botón primario grande** "Empezar — 25 min" (texto dinámico según último config).
  - Debajo, dos links secundarios pequeños (no botones equivalentes): "Personalizar" (abre el row actual `bc-config-row`) y "Modo libre" (dispara `onStart({mode:"freeflow"})`).
  - El row de configuración debe colapsar/expandir con animación suave (max-height + opacity).

#### 2.2 Beat de "centrarse" antes de la calibración
- **`MonitorView.tsx:48-51`** — `handleStart` añade un estado intermedio `"focusing"` (800ms) entre el click y `setPendingConfig`. Durante ese beat:
  - La mascota incrementa saturación de color (CSS variable `--bc-mascot-intensity` 0.7 → 1.0).
  - El aura inhala (escala 0.9 → 1.05).
  - El resto de la UI se desvanece a `opacity: 0.3`.
  - Después: arranca calibración como ahora.
- Implementación mínima: `const [phase, setPhase] = useState<"idle"|"focusing"|"calibrating"|"running"|"done">("idle")`. El render condicional actual ya está bien estructurado para acoger esto.

#### 2.3 Calibración como ritual
- **`CalibrationOverlay.tsx`** — leer y refinar (no he leído aún este archivo, posible que ya tenga buen tono). Cambios:
  - Título principal: "Vamos a centrarnos" (no "Calibrando…").
  - Sub-copy por fase: en lugar de "TOP_LEFT", usar lenguaje natural ("Mira a la esquina superior izquierda. Respira."). Mapping en un `Record<CalibrationPhaseName, string>`.
  - Reducir intensidad visual del overlay: menos opacidad de fondo, más espacio negativo, tipografía display más grande.
  - Una vez `is_calibrated`: una pausa de 600ms con la frase "Listo." antes de que arranque el pomodoro (hoy salta inmediato en `MonitorView.tsx:60-65`).

**Verificación Fase 2**:
- Abrir la app: veo un solo botón "Empezar — 25 min" (con la última config). Personalizar abre los inputs sin saltos.
- Pulsar el botón: la mascota y el aura "respiran" 800ms, luego entra calibración con el copy nuevo.
- Tras calibración: pausa breve "Listo." y arranca el pomodoro.
- Volver a abrir: el botón recuerda la última config.

---

### FASE 3 · Cierre con pico-final (A4)

**Objetivo**: el final es el momento más memorable de la app. Aplicar la regla del pico-final.

#### 3.1 Secuencia en beats
Reescribir el render de `pom.completed` en `MonitorView.tsx:123-142, 165-172` como una secuencia temporizada con `useState<"celebrate"|"insight"|"breakdown"|"cta">`:

| Beat | Tiempo | Contenido |
|---|---|---|
| celebrate | 0 – 1.2s | Mascota animación happy + brillo del aura (sin sparkles emoji). Sin texto. |
| insight | 1.2 – 3.5s | UNA frase grande (~24px), centrada, con la insight más relevante. |
| breakdown | 3.5 – 5s | Aparece el desglose 4-color en pequeño debajo (mantener `bc-done-metric` actual pero como secundario). |
| cta | 5s+ | Aparecen DOS botones: "Tomar descanso" (primario) y "Otra vez" (secundario). |

Implementación: `useEffect` con `setTimeout` encadenados, o un único `useEffect` que avanza el state según `Date.now()`. Cada beat usa la animación `bc-fade-up` ya existente con delays calculados.

#### 3.2 Cálculo de la insight personalizada
Crear utilidad `pickInsight(segs, durationMin, history)` en un nuevo archivo `frontend/web/src/components/braincode/insights.ts`. Reglas en orden de prioridad (la primera que matchea gana):

1. `segs.working > 0.92` → `"Sesión limpia: ${workingMin} min en flow."`
2. `segs.social > 0.15` → `"Las redes te robaron ${Math.round(segs.social*durationMin)} min."`
3. `segs.away > 0.20` → `"Atención fragmentada: ${Math.round(segs.away*100)}% del tiempo distraído."`
4. `segs.absent > 0.15` → `"Demasiadas ausencias. ¿Pausa larga la próxima?"`
5. comparativa con histórico (si `useBackendData()` aporta `metrics`): `"+${diff} min vs tu media."` o `"Tu mejor sesión de hoy."`
6. fallback: `"${workingMin} min de foco."`

Pasar la insight como prop al componente o calcularla inline en `MonitorView`.

#### 3.3 Reemplazar las sparkles emoji
- **`Sparkles.tsx`** — sustituir los 6 emojis (★ ✦) por un sistema más contenido:
  - 8-12 partículas SVG circulares, tamaños 2-5px, color verde/ámbar.
  - Trayectorias bezier (no rectas como ahora).
  - Lifespan 1.2-2.0s con easing pop al inicio y ease-out al fade.
  - Origen distribuido alrededor de la mascota (no detrás del botón).
- Alternativa minimalista (más premium aún): eliminar las sparkles y usar solo un pulso de luz radial desde la mascota — un único radial-gradient que se expande y desvanece. Considerar.

#### 3.4 CTA dual
- Botón primario "Tomar descanso" (5 min): inicia un mini-pomodoro de descanso usando `pom.start({mode:"pomodoro", workMin:5, breakMin:1, totalPoms:1})` o, mejor, una variante `mode:"break"` que requeriría un cambio menor en `usePomodoro` y `state.ts`. **Decisión sencilla**: usar el primer enfoque (sin cambios al hook).
- Botón secundario "Otra vez": llama a `handleReset` (ya existe).

**Verificación Fase 3**:
- Completar una sesión (o forzarla saltando todos los pomodoros): la secuencia se desarrolla en ~5s, sin que el usuario tenga que leer 4 porcentajes a la vez.
- La insight debe variar según el patrón de la sesión (probar con sesiones distintas).
- Las nuevas partículas deben sentirse contenidas, no caóticas.
- Los dos CTAs son visibles y distintos en jerarquía.

---

### FASE 4 · Quick wins restantes (C2, C3, C5, C6)

#### 4.1 Tipografía del timer (C2)
- **`index.css:494-505`** — mantener JetBrains Mono pero añadir `font-feature-settings: "tnum" 1, "ss01" 1, "zero" 1`.
- Añadir transición sutil al cambio de minuto: cuando el primer dígito (`Math.floor(secs/60)`) cambia, animar un fade-down (8px, 200ms). Implementación: dividir el render del timer en `MonitorView.tsx:151` en dos `<span>` (mins y secs), con `key` derivado del valor para forzar el remount → animación.
- No animar al cambiar de segundo (sería ruido).

#### 4.2 Aura ambiental respiratoria (C3)
- **`index.css:312`** `.bc-ambient` — añadir `animation: bc-breathe 5s ease-in-out infinite`. Definir keyframes `bc-breathe` que oscile `transform: scale(1) ↔ scale(1.05)` y `opacity: 0.14 ↔ 0.18`.
- Variantes por estado:
  - `.bc-monitor.working` (necesita añadir esta clase desde `MonitorView.tsx`): respiración 5s.
  - `.bc-monitor.away`: respiración 7s (más lenta, tristona).
  - `.bc-monitor.social`: respiración 2.5s irregular (añadir `cubic-bezier` errático).
  - `.bc-monitor.absent`: sin animación, opacidad muy baja.

#### 4.3 Atajos visibles (C5)
- **`MonitorView.tsx:67-77`** — añadir handlers:
  - `Esc` → `handleReset` (con confirmación si la sesión lleva > 5 min).
  - `S` → `pom.skip` (si no es freeflow).
  - `?` → toggle overlay de atajos.
- Crear `ShortcutsOverlay.tsx`: un panel modal pequeño con 3 filas (Espacio: pausa, S: saltar fase, Esc: terminar). Activado con `?`.
- En el footer del setup idle, añadir un texto sutil "Pulsa ? para atajos".

#### 4.4 Tema oscuro / adaptación temporal (C6)
- **`index.css:1-112`** zona `:root` — duplicar las variables `--bc-*` en una clase `.dark` aplicada a `<html>`. Paleta dark inicial:
  - `--bc-bg`: oklch(15% 0.012 60)
  - `--bc-surface`: oklch(18% 0.014 60)
  - `--bc-text`: oklch(92% 0.01 60)
  - resto: invertir luminosidades manteniendo croma.
- Detección automática:
  - `prefers-color-scheme: dark` → aplicar `.dark`.
  - O lógica horaria: después de las 19h o antes de las 7h, aplicar `.dark`.
  - Toggle manual en settings (fuera del scope de esta pantalla, pero el hook `useTheme` debe quedar listo).
- Validar que la mascota y el aura se ven bien en oscuro (los colores `cfg.hex` son fijos en `state.ts:14-19`; pueden necesitar versión dark).

**Verificación Fase 4**:
- El timer cambia de minuto con un micro-fade que se nota pero no distrae.
- El aura late suave durante working, más lenta en away, errática en social.
- Pulsar `?` abre el overlay de atajos.
- Cambiar la hora del sistema a 21:00 (o `prefers-color-scheme: dark` en el browser): la app se ve en oscuro sin romper contraste.

---

## Archivos modificados — vista global

| Archivo | Fases |
|---|---|
| `frontend/web/src/components/braincode/MonitorView.tsx` | 1, 2, 3, 4 |
| `frontend/web/src/components/braincode/Ring.tsx` | 1 |
| `frontend/web/src/components/braincode/SessionSetup.tsx` | 1, 2 |
| `frontend/web/src/components/braincode/CalibrationOverlay.tsx` | 2 |
| `frontend/web/src/components/braincode/Sparkles.tsx` | 3 |
| `frontend/web/src/components/braincode/insights.ts` (nuevo) | 3 |
| `frontend/web/src/components/braincode/ShortcutsOverlay.tsx` (nuevo) | 4 |
| `frontend/web/src/index.css` | 1, 4 |

Hooks ya existentes que se reutilizan: `useBackendData()` (`hooks.ts:20`), `useFocusTracker()` (`hooks.ts:130`), `usePomodoro()` (`hooks.ts:205`), `useFocusControl()` (`hooks.ts:175`). El evento `bc-state` (`hooks.ts:138`) se reusa para el chip auto-dismiss de 1.2.

---

## Verificación end-to-end

Comandos:
- `cd frontend/web && npm run dev` — dev server en `localhost:8080` (correr cada fase aquí).
- `cd frontend/web && npm run build:app` — bundle a `frontend/index.html` para verificar en pywebview.
- App empaquetada: lanzar el backend Python para probar el flujo real con cámara + calibración.

Tests manuales por fase (lista abajo). No se añaden tests automatizados — esto es UX, la verificación es ojo humano.

**Test cold open** (al final de las 4 fases): pedir a alguien que no conozca la app que la abra y la use 10 minutos. Observar:
- ¿Identifica qué hacer en <5s sin instrucciones?
- ¿La mascota distrae o acompaña durante el trabajo real?
- ¿Recuerda algo específico al día siguiente? Si dice "esa app del cerebrito" o cita la insight, hemos llegado.

---

## Fuera de alcance (para próximas rondas)

- **A1**: rediseño completo de `BrainMascot.tsx` con anatomía y idle behavior — requiere dirección de arte separada.
- **B2**: modo descanso como "otra habitación" — depende de A1.
- **B1**: progresión persistente de la mascota entre sesiones — requiere endpoint backend nuevo.
- **D**: visualización de pomodoros como "barra de viaje", sonido de marca.

Estas se abren como un segundo plan cuando la base de Fases 1-4 esté validada.
