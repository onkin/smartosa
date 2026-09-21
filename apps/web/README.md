# Smartosa Web

Next.js 15 панель. Статический экспорт, данные в IndexedDB.

```bash
pnpm web:dev    # http://localhost:4300
pnpm web:build  # dist/apps/web
```

Динамические id устройств и стен передаются query-параметром (`/devices/edit?id=`), чтобы `output: 'export'` работал без серверных маршрутов.
