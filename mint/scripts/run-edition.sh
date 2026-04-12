#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_CONFIG="${MINT_DIR}/data/${EDITION}/config.toml"
CONFIG_PATH="${CASCADE_MINT_CONFIG:-${DEFAULT_CONFIG}}"
BIN_PATH="${MINT_DIR}/target/release/cascade-mint"

if [[ ! -x "${BIN_PATH}" ]]; then
  echo "missing ${BIN_PATH}; build the release binary first" >&2
  exit 1
fi

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "missing ${CONFIG_PATH}" >&2
  exit 1
fi

cd "${MINT_DIR}"
exec "${BIN_PATH}" --config "${CONFIG_PATH}"
