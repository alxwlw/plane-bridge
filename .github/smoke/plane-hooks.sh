#!/usr/bin/env bash
# Smoke test of a built plane-hooks image. Usage: .github/smoke/plane-hooks.sh <image>
set -euo pipefail
image="${1:?usage: $0 <image>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
docker rm -f ph >/dev/null 2>&1 || true
docker volume rm phsmoke >/dev/null 2>&1 || true
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs ph >&2 || true; fi
  docker rm -f ph >/dev/null 2>&1 || true
  docker volume rm phsmoke >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
cp "$root/apps/plane-hooks/tenants.example.json" "$tmp/tenants.json"
chmod 644 "$tmp/tenants.json"
key="$(openssl genrsa 2048 2>/dev/null | base64 -w0)"
docker run -d --name ph -p 18080:8080 \
  -v "$tmp/tenants.json:/config/tenants.json:ro" -v phsmoke:/data \
  -e PLANE_HOOKS_PLANE_URL=https://plane.example.com \
  -e PLANE_HOOKS_PUBLIC_URL=https://hooks.example.com \
  -e PLANE_HOOKS_ACME_PLANE_SECRET=x \
  -e PLANE_HOOKS_ACME_GRAFANA_TOKEN="ph_$(printf '0a%.0s' {1..24})" \
  -e PLANE_HOOKS_ACME_VERCEL_SECRET=x \
  -e PLANE_HOOKS_ACME_DOKPLOY_SECRET=x \
  -e PLANE_HOOKS_GH_ACME_PRIVATE_KEY="$key" \
  -e PLANE_HOOKS_GH_ACME_WEBHOOK_SECRET=x "$image"
for _ in $(seq 20); do curl -fs localhost:18080/healthz && break; sleep 0.5; done
curl -fs localhost:18080/healthz | grep -qx ok
docker exec ph wget -q --spider http://localhost:8080/healthz
docker logs ph | grep -F '"event":"listening"' | grep -F '"id":"acme"'
docker exec ph test -f /data/plane-hooks.sqlite
