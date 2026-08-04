# Desarrollo del Frontend

El frontend de BrainCODE es una SPA React 18 + TypeScript + Vite + shadcn/ui que se empaqueta como un único HTML autocontenido y se carga dentro de la ventana de pywebview.

## Estructura

```
frontend/
├── app.py                 # Bridge pywebview <-> Python (expone window.pywebview.api)
├── index.html             # Build empaquetado (generado, NO editar a mano)
└── web/                   # Código fuente React
    ├── src/
    │   ├── components/braincode/   # Componentes específicos de la app
    │   ├── components/ui/          # shadcn/ui
    │   └── pages/                  # Index.tsx, NotFound.tsx
    ├── package.json
    ├── vite.config.ts              # Config para `npm run dev`
    ├── vite.singlefile.config.ts   # Config para empaquetar a un único HTML
    └── scripts/copy-to-pywebview.mjs
```

## Comandos

Desde `frontend/web/`:

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (primera vez y tras cambios en package.json) |
| `npm run dev` | Servidor dev en `http://localhost:8080` con HMR. Útil para iterar UI rápido. **Sin pywebview**, así que `window.pywebview.api` será `null` y los datos del bridge no llegarán (esperado). |
| `npm run build:app` | Empaqueta todo en `dist-single/index.html` y lo copia a `frontend/index.html`. **Comando principal antes de lanzar la app desktop.** |
| `npm test` | Ejecuta tests con Vitest |

## Workflow típico

1. Editar componentes en `frontend/web/src/`.
2. Para iteración rápida de UI: `cd frontend/web && npm run dev`.
3. Cuando quieras probar con el backend real: `cd frontend/web && npm run build:app`, luego desde la raíz `python main.py`.

## Bridge con Python

El frontend se comunica con el backend Python vía `window.pywebview.api`, no por HTTP. Los hooks que consumen el bridge están en `frontend/web/src/components/braincode/hooks.ts`:

- `pyApi()` — devuelve `window.pywebview.api` o `null`.
- `waitForPyApi(timeoutMs)` — espera hasta que el bridge esté disponible.
- `useBackendData()` — hace polling cada 15s a `get_today_metrics()` y `get_hourly_breakdown()`.

Los métodos disponibles en el bridge se definen en `frontend/app.py` (clase `Api`). Para añadir un método nuevo, se declara en `Api` y se invoca desde el frontend con `(await waitForPyApi()).<nombre_metodo>()`.
