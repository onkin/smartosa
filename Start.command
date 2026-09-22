#!/bin/bash
cd "$(dirname "$0")" || exit 1
NODE_VERSION=v22.23.2
PREFIX="$(pwd)/deploy/.node"

node_major() {
  "$1" -p "process.versions.node.split('.')[0]" 2>/dev/null
}

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  major="$(node_major node)"
  if [[ "$major" =~ ^[0-9]+$ ]] && [[ "$major" -ge 20 ]]; then
    NODE_BIN="$(command -v node)"
  fi
fi
if [[ -z "$NODE_BIN" && -x "$PREFIX/bin/node" ]]; then
  major="$(node_major "$PREFIX/bin/node")"
  if [[ "$major" =~ ^[0-9]+$ ]] && [[ "$major" -ge 20 ]]; then
    NODE_BIN="$PREFIX/bin/node"
  fi
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "Downloading Node.js. This happens once and needs internet."
  case "$(uname -m)" in
    arm64) node_arch=arm64 ;;
    x86_64) node_arch=x64 ;;
    *)
      echo "This Mac processor is not supported: $(uname -m)"
      read -r -p "Press Enter to close this window…"
      exit 1
      ;;
  esac
  mkdir -p "$PREFIX"
  url="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-${node_arch}.tar.gz"
  set -o pipefail
  if ! curl -fL "$url" | tar -xz -C "$PREFIX" --strip-components=1; then
    echo "Could not download Node.js. Check the internet connection and start again."
    read -r -p "Press Enter to close this window…"
    exit 1
  fi
  NODE_BIN="$PREFIX/bin/node"
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"
echo "Starting Smartosa. The first start can take several minutes. Leave this window open."
node deploy/start.mjs
status=$?
echo
read -r -p "Press Enter to close this window…"
exit "$status"
