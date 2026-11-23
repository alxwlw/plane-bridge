# plane-hooks — Plane App hub: GitHub, Vercel, Dokploy and Grafana → Plane work items.
# Build context: the repository root (docker build -f apps/plane-hooks/Dockerfile .): the image carries
# packages/plane-app and packages/plane-kit as its only dependencies, copied as source. Nothing is installed.
FROM oven/bun:1.4.5-alpine

WORKDIR /app
COPY apps/plane-hooks/tsconfig.json ./
COPY apps/plane-hooks/src ./src
# scripts/ stays: runbooks run inbox.ts, journal.ts, replay.ts and probe-plane.ts through docker exec.
COPY apps/plane-hooks/scripts ./scripts
COPY packages/plane-app/package.json ./node_modules/@alxwlw/plane-app/package.json
COPY packages/plane-app/src ./node_modules/@alxwlw/plane-app/src
COPY packages/plane-kit/package.json ./node_modules/@alxwlw/plane-kit/package.json
COPY packages/plane-kit/src ./node_modules/@alxwlw/plane-kit/src
# A new named volume copies the owner of this directory from the image; without it SQLite cannot open for writing.
RUN mkdir -p /data && chown bun:bun /data

USER bun
EXPOSE 8080
LABEL org.opencontainers.image.title="plane-hooks" \
      org.opencontainers.image.description="Plane App that moves Plane work items by their pull requests and deploys and opens incidents from alerts." \
      org.opencontainers.image.url="https://github.com/alxwlw/plane-bridge/tree/main/apps/plane-hooks" \
      org.opencontainers.image.licenses="MIT"
CMD ["bun", "src/index.ts"]
