#!/bin/sh
set -e
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v docker >/dev/null 2>&1 && [ -f "$root/docker-compose.yml" ]; then
  docker compose -f "$root/docker-compose.yml" down || true
fi
if [ -f "$root/bin/go2rtc.pid" ]; then
  pid=$(cat "$root/bin/go2rtc.pid")
  kill "$pid" 2>/dev/null || true
  rm -f "$root/bin/go2rtc.pid"
fi
echo "go2rtc остановлен"
