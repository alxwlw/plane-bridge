#!/usr/bin/env bash
# Reads tag names (one per line) on stdin; prints "<image>:<tag>" per tag, in input order.
# Usage: tags.sh <image>
set -euo pipefail
# the grammar is ASCII: a locale must not widen the ranges
export LC_ALL=C

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "usage: tags.sh <image>" >&2
  exit 2
fi
image=$1
grammar='^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'
refs=()

while IFS= read -r line || [ -n "$line" ]; do
  tag=${line#"${line%%[![:space:]]*}"}
  tag=${tag%"${tag##*[![:space:]]}"}
  [ -n "$tag" ] || continue
  if ! [[ $tag =~ $grammar ]]; then
    echo "tags.sh: invalid tag '$tag'" >&2
    exit 2
  fi
  refs+=("$image:$tag")
done

if [ "${#refs[@]}" -eq 0 ]; then
  echo "tags.sh: no tags" >&2
  exit 2
fi
printf '%s\n' "${refs[@]}"
