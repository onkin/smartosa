#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 first: https://nodejs.org"
  open "https://nodejs.org" >/dev/null 2>&1 || true
  read -r -p "Press Enter…"
  exit 1
fi
node deploy/start.mjs
status=$?
echo
read -r -p "Press Enter to close this window…"
exit "$status"
