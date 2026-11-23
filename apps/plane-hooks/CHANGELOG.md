# Changelog

All notable changes to `plane-hooks` are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases are tagged `plane-hooks-v<version>`; how a
release is cut: [RELEASING.md](../../RELEASING.md).

## [Unreleased]

## [0.1.0] - 2026-11-23

The first stable release. Before it the image was published as `:main`, `:<commit sha>` and the pre-releases
`0.1.0-rc.N`.

### Added

- Releases: the image is published as `:<version>`, plus `:X.Y` and `:latest` for a stable version, and every version gets a GitHub Release.
- The image is built for `linux/arm64` as well as `linux/amd64`.
- The tenant setting `locale`, `en` (the default) or `ru`: the language of every text the app writes.

### Changed

- **Breaking:** a tenant without `locale` now gets English, where every text was Russian before. To stay Russian, add `"locale": "ru"` to each such tenant in `tenants.json` before updating.

### Fixed

- `scripts/probe-plane.ts` no longer exits 1 when `POST /releases/` answers 403 (an App bot token has no releases scope, as on Plane Cloud): the release section is skipped with the reason, as it already was for 402.
- The image labels `org.opencontainers.image.title`, `description`, `url` and `licenses` describe this app; they were inherited from the `oven/bun` base image.
