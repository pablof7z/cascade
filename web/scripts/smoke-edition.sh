#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"

case "${EDITION}" in
  signet)
    BASE_URL="${BASE_URL:-http://127.0.0.1:4173}"
    ;;
  mainnet)
    BASE_URL="${BASE_URL:-http://127.0.0.1:4174}"
    ;;
  *)
    echo "unknown edition: ${EDITION}" >&2
    exit 1
    ;;
esac

curl -fsS "${BASE_URL}/" >/dev/null
curl -fsS "${BASE_URL}/builder" >/dev/null
curl -fsS "${BASE_URL}/wallet" >/dev/null

echo "web ${EDITION} smoke checks passed for ${BASE_URL}"
