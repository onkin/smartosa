#!/bin/sh
set -e
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$root/config" "$root/bin"
if [ ! -f "$root/config/go2rtc.yaml" ]; then
  cp "$root/config/go2rtc.yaml.example" "$root/config/go2rtc.yaml"
fi

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$root/docker-compose.yml" up -d
  echo "go2rtc (docker): http://127.0.0.1:1984"
  exit 0
fi

os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
case "$os-$arch" in
  darwin-arm64) asset=go2rtc_mac_arm64.zip ;;
  darwin-x86_64) asset=go2rtc_mac_amd64.zip ;;
  linux-x86_64) asset=go2rtc_linux_amd64 ;;
  linux-aarch64) asset=go2rtc_linux_arm64 ;;
  *)
    echo "Нет готового бинарника для $os/$arch. Поставьте Docker и повторите."
    exit 1
    ;;
esac

bin="$root/bin/go2rtc"
if [ ! -x "$bin" ]; then
  url="https://github.com/AlexxIT/go2rtc/releases/latest/download/$asset"
  echo "Docker не найден, качаю $url"
  tmp="$root/bin/download"
  curl -fsSL "$url" -o "$tmp"
  case "$asset" in
    *.zip)
      unzip -o -j "$tmp" -d "$root/bin"
      rm -f "$tmp"
      ;;
    *)
      mv "$tmp" "$bin"
      ;;
  esac
  chmod +x "$bin"
fi

if [ -f "$root/bin/go2rtc.pid" ] && kill -0 "$(cat "$root/bin/go2rtc.pid")" 2>/dev/null; then
  echo "go2rtc уже запущен: http://127.0.0.1:1984"
  exit 0
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# nohup: иначе процесс умирает вместе с оболочкой, из которой его запустили.
/usr/bin/nohup "$bin" -config "$root/config/go2rtc.yaml" >>"$root/bin/go2rtc.log" 2>&1 &
echo $! >"$root/bin/go2rtc.pid"
echo "go2rtc (binary): http://127.0.0.1:1984"
