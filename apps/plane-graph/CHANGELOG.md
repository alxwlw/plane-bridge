# Changelog

All notable changes to `plane-graph` are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases are tagged `plane-graph-v<version>`; how a
release is cut: [RELEASING.md](../../RELEASING.md).

## [Unreleased]

The first versioned release; until now the image was published only as `:main` and `:<commit sha>`.

### Added

- Releases: the image is published as `:<version>`, plus `:X.Y` and `:latest` for a stable version, and every version gets a GitHub Release.
- The image is built for `linux/arm64` as well as `linux/amd64`.
- The tenant setting `locale`, `en` (the default) or `ru`: the language of every text the app writes.
- `PLANE_GRAPH_PLANE_WEB_URL`: the Plane web address of work-item links, default `PLANE_GRAPH_PLANE_URL`; on Plane Cloud `https://app.plane.so` while the API stays `https://api.plane.so`.
- The tenant setting `areaPrefix`: the prefix of the labels that name an area.

### Changed

- **Breaking:** a tenant without `locale` now gets English, where every text was Russian before. To stay Russian, add `"locale": "ru"` to each such tenant in `tenants.json` before updating.
- **Breaking:** the area label prefix defaults to `area:`, where it was `код:` before. A team whose area labels start with `код:` sets `"areaPrefix": "код:"` on its tenant before updating.
