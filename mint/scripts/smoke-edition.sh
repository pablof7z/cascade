#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"

case "${EDITION}" in
  signet)
    BASE_URL="${BASE_URL:-http://127.0.0.1:3342}"
    ;;
  mainnet)
    BASE_URL="${BASE_URL:-http://127.0.0.1:3338}"
    ;;
  *)
    echo "unknown edition: ${EDITION}" >&2
    exit 1
    ;;
esac

curl -fsS "${BASE_URL}/health"
curl -fsS "${BASE_URL}/v1/info" >/dev/null
curl -fsS "${BASE_URL}/api/product/feed" >/dev/null

echo "mint ${EDITION} smoke checks passed for ${BASE_URL}"
