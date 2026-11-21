# plane-miro — Plane ↔ Miro service.
# Build context: the repository root (docker build -f apps/plane-miro/Dockerfile .). The image carries packages/plane-kit as its only dependency, copied as source. Nothing is installed.
FROM oven/bun:1.4.5-alpine

WORKDIR /app
COPY apps/plane-miro/tsconfig.json ./
COPY apps/plane-miro/src ./src
# web/ is bundled by Bun.build at start and served by the service itself.
COPY apps/plane-miro/web ./web
COPY apps/plane-miro/scripts ./scripts
COPY packages/plane-kit/package.json ./node_modules/@alxwlw/plane-kit/package.json
COPY packages/plane-kit/src ./node_modules/@alxwlw/plane-kit/src
# A new named volume copies the owner of this directory from the image; without it SQLite cannot open for writing.
RUN mkdir -p /data && chown bun:bun /data

USER bun
EXPOSE 8080
CMD ["bun", "src/index.ts"]
