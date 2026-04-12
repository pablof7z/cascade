#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Install the Cascade CLI from GitHub Releases.

Usage:
  ./skills/cascade/install-cascade.sh [--version <tag>] [--repo <owner/name>] [--install-dir <dir>]

Options:
  --version <tag>       Release tag to install, for example cascade-cli-v0.1.0.
                        Defaults to the latest release.
  --repo <owner/name>   GitHub repository. Defaults to pablof7z/cascade.
  --install-dir <dir>   Directory to place the binary in.
                        Defaults to ~/.cascade/bin.
  --help                Show this help text.
EOF
}

repo="pablof7z/cascade"
version="latest"
install_dir="${HOME}/.cascade/bin"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      version="${2:?missing value for --version}"
      shift 2
      ;;
    --repo)
      repo="${2:?missing value for --repo}"
      shift 2
      ;;
    --install-dir)
      install_dir="${2:?missing value for --install-dir}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unsupported argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "${uname_s}:${uname_m}" in
  Darwin:x86_64)
    target="x86_64-apple-darwin"
    ;;
  Darwin:arm64|Darwin:aarch64)
    target="aarch64-apple-darwin"
    ;;
  Linux:x86_64|Linux:amd64)
    target="x86_64-unknown-linux-musl"
    ;;
  Linux:arm64|Linux:aarch64)
    target="aarch64-unknown-linux-musl"
    ;;
  *)
    echo "Unsupported platform: ${uname_s} ${uname_m}" >&2
    exit 1
    ;;
esac

archive="cascade-${target}.tar.gz"
release_base="https://github.com/${repo}/releases"

if [ "${version}" = "latest" ]; then
  asset_url="${release_base}/latest/download/${archive}"
  checksums_url="${release_base}/latest/download/checksums.txt"
else
  asset_url="${release_base}/download/${version}/${archive}"
  checksums_url="${release_base}/download/${version}/checksums.txt"
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

echo "Downloading ${asset_url}" >&2
curl -fsSL "${asset_url}" -o "${tmp_dir}/${archive}"
curl -fsSL "${checksums_url}" -o "${tmp_dir}/checksums.txt"

if ! grep -E "[[:space:]]${archive}$" "${tmp_dir}/checksums.txt" > "${tmp_dir}/${archive}.sha256"; then
  echo "Checksum entry for ${archive} not found" >&2
  exit 1
fi

(
  cd "${tmp_dir}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${archive}.sha256"
  else
    shasum -a 256 -c "${archive}.sha256"
  fi
)

tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"

mkdir -p "${install_dir}"
install "${tmp_dir}/cascade-${target}/cascade" "${install_dir}/cascade"

echo "Installed ${install_dir}/cascade" >&2
