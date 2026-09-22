# Smartosa

A home dashboard for IP cameras and other devices on the local network. The panel runs in the browser. Each home's devices, walls, and addresses stay in that browser (IndexedDB).

| App / package | Role |
|---------------|------|
| [`apps/web`](./apps/web) | Next.js 15 panel (static export) |
| [`packages/core`](./packages/core) | Devices, walls, visits, and storage, without React |
| [`packages/brand`](./packages/brand) | Dark theme and CSS variables |

## Give this to someone else

Send them this file: [Download ZIP](https://github.com/onkin/smartosa/archive/refs/heads/main.zip). GitHub builds that archive from the repository. There is no separate installer, and camera passwords are not in it.

They unzip the folder and double-click one file:

- macOS: `Start.command`. If the system refuses to open it, right-click the file and choose Open.
- Windows: `Start.bat`.

The first start needs internet. It downloads Node.js, project files, and go2rtc, then opens the panel in the browser. That can take several minutes. The black window must stay open.

Also send your backup: **Settings → Download JSON** on your computer, **Settings → Import JSON** on theirs. That file holds the cameras. Do not send `deploy/go2rtc/config/go2rtc.yaml`.

`git clone https://github.com/onkin/smartosa.git` is the same source if Git is already installed.

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
