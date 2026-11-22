# plane-discord — Plane ↔ Discord bridge.
# Build context: the repository root (docker build -f apps/plane-discord/Dockerfile .). The image carries packages/plane-app and packages/plane-kit as its only dependencies, copied as source. Nothing is installed.
FROM oven/bun:1.4.5-alpine

WORKDIR /app
COPY apps/plane-discord/tsconfig.json ./
COPY apps/plane-discord/src ./src
# scripts/ stays: runbooks run register-commands.ts and list-channels.ts through docker exec.
COPY apps/plane-discord/scripts ./scripts
COPY packages/plane-app/package.json ./node_modules/@alxwlw/plane-app/package.json
COPY packages/plane-app/src ./node_modules/@alxwlw/plane-app/src
COPY packages/plane-kit/package.json ./node_modules/@alxwlw/plane-kit/package.json
COPY packages/plane-kit/src ./node_modules/@alxwlw/plane-kit/src
# A new named volume copies the owner of this directory from the image; without it SQLite cannot open for writing.
RUN mkdir -p /data && chown bun:bun /data

USER bun
EXPOSE 8080
CMD ["bun", "src/index.ts"]
