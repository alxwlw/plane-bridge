#!/usr/bin/env bash
# Prints the value of the one org.opencontainers.image.description="…" label in a Dockerfile.
# Usage: description.sh <dockerfile>
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "usage: description.sh <dockerfile>" >&2
  exit 2
fi
file=$1

lines=$(grep -E '^[[:space:]]*(LABEL[[:space:]]+)?org\.opencontainers\.image\.description="[^"]*"' "$file" || true)
if [ -z "$lines" ]; then
  echo "description.sh: $file: no org.opencontainers.image.description label" >&2
  exit 1
fi
if [ "$(printf '%s\n' "$lines" | wc -l)" -ne 1 ]; then
  echo "description.sh: $file: more than one org.opencontainers.image.description label" >&2
  exit 1
fi
value=$(printf '%s\n' "$lines" | sed -E 's/^[^"]*"([^"]*)".*$/\1/')
if [ -z "$value" ]; then
  echo "description.sh: $file: empty org.opencontainers.image.description" >&2
  exit 1
fi
printf '%s\n' "$value"
