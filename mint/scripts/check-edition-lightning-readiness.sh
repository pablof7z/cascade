#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

case "${EDITION}" in
  signet)
    CONFIG_PATH="${CASCADE_MINT_CONFIG:-${MINT_DIR}/data/signet/config.toml}"
    BASE_URL="${BASE_URL:-http://127.0.0.1:3342}"
    EXPECTED_INVOICE_PREFIX="lntbs"
    ;;
  mainnet)
    CONFIG_PATH="${CASCADE_MINT_CONFIG:-${MINT_DIR}/data/mainnet/config.toml}"
    BASE_URL="${BASE_URL:-http://127.0.0.1:3338}"
    EXPECTED_INVOICE_PREFIX="lnbc"
    ;;
  *)
    echo "unknown edition: ${EDITION}" >&2
    exit 1
    ;;
esac

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "missing config: ${CONFIG_PATH}" >&2
  exit 1
fi

MACAROON_PATH="$(sed -n 's/^macaroon_path = "\(.*\)"/\1/p' "${CONFIG_PATH}" | head -n 1)"
if [[ -z "${MACAROON_PATH}" ]]; then
  echo "macaroon_path missing from ${CONFIG_PATH}" >&2
  exit 1
fi

if [[ ! -f "${MACAROON_PATH}" ]]; then
  echo "missing macaroon: ${MACAROON_PATH}" >&2
  exit 1
fi

RUNTIME_JSON="$(curl -fsS "${BASE_URL}/api/product/runtime")"
RUNTIME_EDITION="$(
  node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(String(data.edition || ""));' \
    <<<"${RUNTIME_JSON}"
)"

if [[ "${RUNTIME_EDITION}" != "${EDITION}" ]]; then
  echo "edition mismatch: runtime reports ${RUNTIME_EDITION}, expected ${EDITION}" >&2
  exit 1
fi

TOPUP_JSON="$(
  curl -fsS \
    -X POST \
    -H 'content-type: application/json' \
    -H "x-cascade-edition: ${EDITION}" \
    --data "{\"pubkey\":\"${EDITION}-lightning-readiness\",\"amount_minor\":100}" \
    "${BASE_URL}/api/wallet/topups/lightning/quote"
)"

INVOICE_PREFIX="$(
  node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0, "utf8")); const invoice=String(data.invoice || ""); process.stdout.write(invoice.slice(0, 5));' \
    <<<"${TOPUP_JSON}"
)"

if [[ "${INVOICE_PREFIX}" != "${EXPECTED_INVOICE_PREFIX}" ]]; then
  echo "unexpected invoice prefix: ${INVOICE_PREFIX} (expected ${EXPECTED_INVOICE_PREFIX})" >&2
  exit 1
fi

echo "edition ${EDITION} Lightning readiness passed for ${BASE_URL}"
