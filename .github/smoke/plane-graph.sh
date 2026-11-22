#!/usr/bin/env bash
# Smoke test of a built plane-graph image. Usage: .github/smoke/plane-graph.sh <image>
set -euo pipefail
image="${1:?usage: $0 <image>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
docker rm -f pg >/dev/null 2>&1 || true
docker volume rm pgsmoke >/dev/null 2>&1 || true
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then docker logs pg >&2 || true; fi
  docker rm -f pg >/dev/null 2>&1 || true
  docker volume rm pgsmoke >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
cp "$root/apps/plane-graph/tenants.example.json" "$tmp/tenants.json"
chmod 644 "$tmp/tenants.json"
docker run -d --name pg -p 18080:8080 \
  -v "$tmp/tenants.json:/config/tenants.json:ro" -v pgsmoke:/data \
  -e PLANE_GRAPH_PLANE_URL=https://plane.example.com \
  -e PLANE_GRAPH_PUBLIC_URL=https://plane-graph.example.com \
  -e PLANE_GRAPH_EX_PLANE_SECRET=x \
  -e PLANE_GRAPH_EX_WEBHOOK_SECRET=x \
  -e PLANE_GRAPH_EX_READ_KEY=read-x \
  -e PLANE_GRAPH_EX_AGENT_KEY=agent-x "$image"
for _ in $(seq 20); do curl -fs --max-time 2 localhost:18080/healthz && break; sleep 0.5; done
curl -fs --max-time 5 localhost:18080/healthz | grep -qx ok
docker exec pg wget -q --spider http://localhost:8080/healthz
body=$(curl -fs --max-time 5 localhost:18080/assets/graph.js)
grep -q . <<<"$body"
docker logs pg | grep -F '"event":"listening"' | grep -F '"id":"ex"'
docker exec pg test -f /data/plane-graph.sqlite
