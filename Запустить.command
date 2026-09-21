#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Сначала поставьте Node.js 20: https://nodejs.org"
  open "https://nodejs.org" >/dev/null 2>&1 || true
  read -r -p "Нажмите Enter…"
  exit 1
fi
node deploy/start.mjs
status=$?
echo
read -r -p "Нажмите Enter, чтобы закрыть окно…"
exit "$status"
