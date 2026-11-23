# plane-graph — read-only copy of Plane work items and relations, an order graph and agent endpoints.
# Build context: the repository root (docker build -f apps/plane-graph/Dockerfile .): the image carries
# packages/plane-app and packages/plane-kit as its only dependencies, copied as source. Nothing is installed.
FROM oven/bun:1.4.5-alpine

WORKDIR /app
COPY apps/plane-graph/tsconfig.json ./
COPY apps/plane-graph/src ./src
# web/ is bundled by Bun.build at start and served by the service itself.
COPY apps/plane-graph/web ./web
COPY apps/plane-graph/scripts ./scripts
COPY packages/plane-app/package.json ./node_modules/@alxwlw/plane-app/package.json
COPY packages/plane-app/src ./node_modules/@alxwlw/plane-app/src
COPY packages/plane-kit/package.json ./node_modules/@alxwlw/plane-kit/package.json
COPY packages/plane-kit/src ./node_modules/@alxwlw/plane-kit/src
# A new named volume copies the owner of this directory from the image; without it SQLite cannot open for writing.
RUN mkdir -p /data && chown bun:bun /data

USER bun
EXPOSE 8080
LABEL org.opencontainers.image.title="plane-graph" \
      org.opencontainers.image.description="Plane App that draws the order of work in a Plane workspace and serves the same data to an agent." \
      org.opencontainers.image.url="https://github.com/alxwlw/plane-bridge/tree/main/apps/plane-graph" \
      org.opencontainers.image.licenses="MIT"
CMD ["bun", "src/index.ts"]
