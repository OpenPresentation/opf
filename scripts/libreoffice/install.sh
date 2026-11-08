#!/usr/bin/env bash
# Install the pinned LibreOffice of scripts/libreoffice/environment.json into /opt (docs/libreoffice.md).
# Runs as root in the pinned Playwright image (the CI leg and the Dockerfile). The tarball is The Document Foundation's own
# Debian build from its permanent archive, checked against the pinned SHA-256 before anything is unpacked.
#   scripts/libreoffice/install.sh [cache-directory]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cache="${1:-${TMPDIR:-/tmp}/opf-libreoffice}"
field() { node -e 'const e=require(process.argv[1]);const v=process.argv[2].split(".").reduce((o,k)=>o[k],e);console.log(Array.isArray(v)?v.join(" "):v)' "$here/environment.json" "$1"; }
version="$(field libreoffice.version)"
url="$(field libreoffice.url)"
sha="$(field libreoffice.sha256)"
program="$(field libreoffice.program)"
packages="$(field aptPackages)"

export DEBIAN_FRONTEND=noninteractive
# shellcheck disable=SC2086
apt-get update -qq && apt-get install -y -qq --no-install-recommends $packages >/dev/null

mkdir -p "$cache"
tarball="$cache/$(basename "$url")"
if [ ! -f "$tarball" ] || ! echo "$sha  $tarball" | sha256sum -c --status; then
  curl -fsSL --retry 3 --retry-delay 5 -o "$tarball.part" "$url"
  mv "$tarball.part" "$tarball"
fi
echo "$sha  $tarball" | sha256sum -c -

work="$(mktemp -d)"
tar -xzf "$tarball" -C "$work"
dpkg -i "$work"/LibreOffice_*/DEBS/*.deb >/dev/null
rm -rf "$work"
ln -sf "$program" /usr/local/bin/soffice

installed="$("$program" --version)"
echo "$installed"
case "$installed" in
  *"$version"*) ;;
  *) echo "expected LibreOffice $version, found: $installed" >&2; exit 1 ;;
esac
