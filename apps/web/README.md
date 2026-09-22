# Smartosa Web

Next.js 15 panel. Static export, data in IndexedDB.

```bash
pnpm web:dev    # http://localhost:4300
pnpm web:build  # dist/apps/web
```

Device and wall ids are query parameters (`/devices/edit?id=`) so `output: 'export'` does not need server routes.
