#!/usr/bin/env bash
# Smoke test of a built plane-miro image. Usage: .github/smoke/plane-miro.sh <image>
set -euo pipefail
image="${1:?usage: $0 <image>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
docker rm -f pm >/dev/null 2>&1 || true
docker volume rm pmsmoke >/dev/null 2>&1 || true
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs pm >&2 || true; fi
  docker rm -f pm >/dev/null 2>&1 || true
  docker volume rm pmsmoke >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
cp "$root/apps/plane-miro/tenants.example.json" "$tmp/tenants.json"
chmod 644 "$tmp/tenants.json"
docker run -d --name pm -p 18080:8080 \
  -v "$tmp/tenants.json:/config/tenants.json:ro" -v pmsmoke:/data \
  -e PLANE_MIRO_PLANE_URL=https://plane.example.com \
  -e PLANE_MIRO_PUBLIC_URL=https://plane-miro.example.com \
  -e PLANE_MIRO_MIRO_CLIENT_ID=3458764500000000099 \
  -e PLANE_MIRO_MIRO_CLIENT_SECRET=x \
  -e PLANE_MIRO_ACME_PLANE_SECRET=x \
  -e PLANE_MIRO_ACME_WEBHOOK_SECRET=x \
  -e PLANE_MIRO_BETA_PLANE_SECRET=x \
  -e PLANE_MIRO_BETA_WEBHOOK_SECRET=x "$image"
for _ in $(seq 20); do curl -fs --max-time 2 localhost:18080/healthz && break; sleep 0.5; done
curl -fs --max-time 5 localhost:18080/healthz | grep -qx ok
docker exec pm wget -q --spider http://localhost:8080/healthz
# The pages answer GET only (a HEAD is 405), so the headers come from a GET with the body dropped.
curl -fsD - --max-time 5 -o /dev/null localhost:18080/miro/panel | grep -i '^content-security-policy: frame-ancestors https://miro.com'
docker logs pm | grep -F '"event":"listening"' | grep -F '"id":"acme"'
docker exec pm test -f /data/plane-miro.sqlite
