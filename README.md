# Smartosa

Домашняя веб-морда для IP-камер и устройств в локальной сети. Фаза A: всё крутится в браузере, конфиг живёт в IndexedDB.

| App / package | Role |
|---------------|------|
| [`apps/web`](./apps/web) | Next.js 15 панель (static export) |
| [`packages/core`](./packages/core) | Устройства, стены, визиты, репозиторий — без React |
| [`packages/brand`](./packages/brand) | Тёмная тема и CSS-переменные |

## Stack

- **Monorepo**: pnpm 8.15 + Nx 21
- **Web**: Next.js 15, React 19, CSS modules
- **Shared**: `@smartosa/core`, `@smartosa/brand`

## Run

```bash
pnpm install
pnpm web:dev     # http://localhost:4300
pnpm test
pnpm web:build   # статика → dist/apps/web
```

URL устройств могут содержать `{lan}` и `{wan}` — хосты задаются в настройках.

Браузер не умеет RTSP напрямую. Локальный шлюз:

```bash
pnpm go2rtc:up          # http://127.0.0.1:1984
```

В карточке камеры: вставь RTSP → **Отдать RTSP в go2rtc** → режим **go2rtc**.
