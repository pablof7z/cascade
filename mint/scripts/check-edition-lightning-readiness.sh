#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <signet|mainnet>" >&2
  exit 1
fi

EDITION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

toml_get() {
  local section="$1"
  local key="$2"
  awk -F' = ' -v section="${section}" -v key="${key}" '
    /^\[/ { in_section = ($0 == "[" section "]") }
    in_section && $1 == key {
      value = $2
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      print value
      exit
    }
  ' "${CONFIG_PATH}"
}

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

CLI_PATH="$(toml_get lnd cli_path)"
LND_HOST="$(toml_get lnd host)"
LND_PORT="$(toml_get lnd port)"
CERT_PATH="$(toml_get lnd cert_path)"
MACAROON_PATH="$(toml_get lnd macaroon_path)"

if [[ -z "${CLI_PATH}" ]]; then
  echo "cli_path missing from ${CONFIG_PATH}" >&2
  exit 1
fi

if [[ ! -x "${CLI_PATH}" ]]; then
  echo "missing executable cli_path: ${CLI_PATH}" >&2
  exit 1
fi

if [[ -z "${MACAROON_PATH}" ]]; then
  echo "macaroon_path missing from ${CONFIG_PATH}" >&2
  exit 1
fi

if [[ -z "${CERT_PATH}" ]]; then
  echo "cert_path missing from ${CONFIG_PATH}" >&2
  exit 1
fi

if [[ ! -f "${CERT_PATH}" ]]; then
  echo "missing cert: ${CERT_PATH}" >&2
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
    --data "{\"amount\":100,\"unit\":\"usd\",\"description\":\"${EDITION} readiness check\"}" \
    "${BASE_URL}/v1/mint/quote/bolt11"
)"

INVOICE_PREFIX="$(
  node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0, "utf8")); const invoice=String(data.request || ""); process.stdout.write(invoice.slice(0, 5));' \
    <<<"${TOPUP_JSON}"
)"

if [[ "${INVOICE_PREFIX}" != "${EXPECTED_INVOICE_PREFIX}" ]]; then
  echo "unexpected invoice prefix: ${INVOICE_PREFIX} (expected ${EXPECTED_INVOICE_PREFIX})" >&2
  exit 1
fi

LND_INFO_JSON="$(
  "${CLI_PATH}" \
    --rpcserver="${LND_HOST}:${LND_PORT}" \
    --tlscertpath="${CERT_PATH}" \
    --macaroonpath="${MACAROON_PATH}" \
    getinfo
)"
LND_WALLET_JSON="$(
  "${CLI_PATH}" \
    --rpcserver="${LND_HOST}:${LND_PORT}" \
    --tlscertpath="${CERT_PATH}" \
    --macaroonpath="${MACAROON_PATH}" \
    walletbalance
)"
LND_CHANNELS_JSON="$(
  "${CLI_PATH}" \
    --rpcserver="${LND_HOST}:${LND_PORT}" \
    --tlscertpath="${CERT_PATH}" \
    --macaroonpath="${MACAROON_PATH}" \
    listchannels
)"

node - <<'EOF' "${LND_INFO_JSON}" "${LND_WALLET_JSON}" "${LND_CHANNELS_JSON}" "${EDITION}"
const info = JSON.parse(process.argv[2]);
const wallet = JSON.parse(process.argv[3]);
const channels = JSON.parse(process.argv[4]);
const edition = process.argv[5];

if (!info.synced_to_chain) {
  console.error(`edition ${edition} Lightning readiness failed: lnd is not synced to chain`);
  process.exit(1);
}

const totalBalance = Number.parseInt(wallet.total_balance ?? '0', 10) || 0;
const activeChannels = Array.isArray(channels.channels)
  ? channels.channels.filter((channel) => channel?.active).length
  : 0;

if (totalBalance <= 0 && activeChannels === 0) {
  console.error(
    `edition ${edition} Lightning readiness failed: configured lnd has zero wallet balance and zero active channels`
  );
  process.exit(1);
}

if (activeChannels === 0) {
  console.error(
    `edition ${edition} Lightning readiness warning: lnd reports zero active channels; outbound Lightning payments may still fail`
  );
}
EOF

echo "edition ${EDITION} Lightning readiness passed for ${BASE_URL}"
