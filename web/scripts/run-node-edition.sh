#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${WEB_DIR}/.env.${EDITION}.local"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

case "${EDITION}" in
  signet)
    : "${PUBLIC_CASCADE_EDITION:=signet}"
    : "${PUBLIC_CASCADE_MINT_URL:=http://127.0.0.1:3342}"
    : "${PUBLIC_CASCADE_API_URL:=http://127.0.0.1:3342}"
    : "${PORT:=4173}"
    : "${HOST:=127.0.0.1}"
    : "${ORIGIN:=http://127.0.0.1:4173}"
    ;;
  mainnet)
    : "${PUBLIC_CASCADE_EDITION:=mainnet}"
    : "${PUBLIC_CASCADE_MINT_URL:=https://mint.f7z.io}"
    : "${PUBLIC_CASCADE_API_URL:=https://mint.f7z.io}"
    : "${PORT:=4174}"
    : "${HOST:=127.0.0.1}"
    : "${ORIGIN:=https://cascade.f7z.io}"
    ;;
  *)
    echo "unknown edition: ${EDITION}" >&2
    exit 1
    ;;
esac

export PUBLIC_CASCADE_EDITION
export PUBLIC_CASCADE_MINT_URL
export PUBLIC_CASCADE_API_URL
export PORT
export HOST
export ORIGIN

if [[ ! -f "${WEB_DIR}/build/index.js" ]]; then
  echo "missing ${WEB_DIR}/build/index.js; run web/scripts/build-node-edition.sh first" >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-}"
if [[ -n "${NODE_BIN}" && "${NODE_BIN}" != /* ]]; then
  if command -v "${NODE_BIN}" >/dev/null 2>&1; then
    NODE_BIN="$(command -v "${NODE_BIN}")"
  else
    NODE_BIN=""
  fi
fi

if [[ -z "${NODE_BIN}" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [[ -x "/Users/customer/.nvm/versions/node/v23.11.1/bin/node" ]]; then
    NODE_BIN="/Users/customer/.nvm/versions/node/v23.11.1/bin/node"
  else
    echo "node binary not found; set NODE_BIN explicitly" >&2
    exit 1
  fi
fi

cd "${WEB_DIR}"
exec "${NODE_BIN}" build/index.js
