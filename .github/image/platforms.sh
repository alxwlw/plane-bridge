#!/usr/bin/env bash
# Checks that a manifest list holds linux/amd64 and linux/arm64; prints its index digest.
# Usage: platforms.sh <ref>
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "usage: platforms.sh <ref>" >&2
  exit 2
fi
ref=$1
manifest=$(docker buildx imagetools inspect "$ref" --format '{{json .Manifest}}')

for platform in linux/amd64 linux/arm64; do
  os=${platform%/*}
  arch=${platform#*/}
  if ! jq -e --arg os "$os" --arg arch "$arch" \
    '[.manifests[]? | select(.platform.os == $os and .platform.architecture == $arch)] | length > 0' \
    <<<"$manifest" >/dev/null; then
    echo "platforms.sh: $ref lacks $platform" >&2
    exit 1
  fi
done
jq -r .digest <<<"$manifest"
