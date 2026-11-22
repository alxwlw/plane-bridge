#!/usr/bin/env bash
# Smoke test of a built plane-discord image. Usage: .github/smoke/plane-discord.sh <image>
set -euo pipefail
image="${1:?usage: $0 <image>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
docker rm -f pd >/dev/null 2>&1 || true
docker volume rm pdsmoke >/dev/null 2>&1 || true
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs pd >&2 || true; fi
  docker rm -f pd >/dev/null 2>&1 || true
  docker volume rm pdsmoke >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
cp "$root/apps/plane-discord/tenants.example.json" "$tmp/tenants.json"
chmod 644 "$tmp/tenants.json"
key="$(printf '0a%.0s' {1..32})"
docker run -d --name pd -p 18080:8080 \
  -v "$tmp/tenants.json:/config/tenants.json:ro" -v pdsmoke:/data \
  -e PLANE_DISCORD_PLANE_URL=https://plane.example.com \
  -e PLANE_DISCORD_PUBLIC_URL=https://plane-discord.example.com \
  -e PLANE_DISCORD_DISCORD_APPLICATION_ID=123456789012345678 \
  -e PLANE_DISCORD_DISCORD_PUBLIC_KEY="$key" \
  -e PLANE_DISCORD_DISCORD_BOT_TOKEN=x \
  -e PLANE_DISCORD_ACME_PLANE_SECRET=x \
  -e PLANE_DISCORD_ACME_WEBHOOK_SECRET=x "$image"
for _ in $(seq 20); do curl -fs --max-time 2 localhost:18080/healthz && break; sleep 0.5; done
curl -fs --max-time 5 localhost:18080/healthz | grep -qx ok
docker exec pd wget -q --spider http://localhost:8080/healthz
docker logs pd | grep -F '"event":"listening"' | grep -F '"id":"acme"'
docker exec pd test -f /data/plane-discord.sqlite
