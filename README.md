# Smartosa

A home dashboard for IP cameras and other devices on the local network. The panel runs in the browser. Each home's devices, walls, and addresses stay in that browser (IndexedDB).

| App / package | Role |
|---------------|------|
| [`apps/web`](./apps/web) | Next.js 15 panel (static export) |
| [`packages/core`](./packages/core) | Devices, walls, visits, and storage, without React |
| [`packages/brand`](./packages/brand) | Dark theme and CSS variables |

## Download

GitHub already packs the repository. You do not need a separate installer archive.

- [Download ZIP](https://github.com/onkin/smartosa/archive/refs/heads/main.zip)
- Or open the repository and choose **Code → Download ZIP**

Unzip the folder, install [Node.js 20](https://nodejs.org), then start the panel with the launcher below. `git clone https://github.com/onkin/smartosa.git` is the same source if Git is already installed.

## Install on another computer

1. Install [Node.js 20](https://nodejs.org) or newer.
2. macOS: double-click `Start.command`.
3. Windows: double-click `Start.bat`.

The window installs dependencies, starts go2rtc, builds the panel the first time, and serves it at <http://127.0.0.1:4300>. It also prints the address for a phone on the same Wi-Fi. Leave the window open. Closing it stops the panel.

Cameras are not inside the download. On the old computer use **Settings → Download JSON**. On the new one use **Import JSON**. Do not copy `deploy/go2rtc/config/go2rtc.yaml`: that file holds camera passwords and is not in git.

## Develop

```bash
pnpm install
pnpm web:dev     # http://localhost:4300
pnpm test
pnpm web:build   # static files → dist/apps/web
```

Device URLs may contain `{lan}` and `{wan}`. Those hosts are set in Settings.

The browser cannot play RTSP by itself. A local gateway does that:

```bash
pnpm go2rtc:up          # http://127.0.0.1:1984
pnpm go2rtc:down
```

On a camera card: paste the RTSP URL, use **Отдать превью в go2rtc**, then set **Режим в браузере** to **go2rtc**. The panel interface itself stays in Russian.

## Stack

- **Monorepo**: pnpm 8.15 + Nx 21
- **Web**: Next.js 15, React 19, CSS modules
- **Shared**: `@smartosa/core`, `@smartosa/brand`
