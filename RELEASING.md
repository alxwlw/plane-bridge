# Releasing

How a maintainer cuts a release of an app in `apps/`.

## Versions

Each app under `apps/` has its own SemVer version in `apps/<app>/package.json`. `packages/*` are not released on
their own: they ship inside the images, so a change there reaches users only when the apps that use it are
released, and the person cutting the release decides which ones.

While at `0.x`, a breaking change to configuration (a tenant key, an environment variable, a default, a route)
raises the minor, and its changelog bullet starts with **Breaking:** and says how to upgrade. Anything else
raises the patch.

## Image tags

`:<version>` always. For a stable version also `:X.Y` and `:latest`, unless a newer release of the app already
has them. A pre-release (`X.Y.Z-rc.N`) gets only its own tag. Every push to `main` still publishes `:main` and
`:<commit sha>`. Users are pointed at `:X.Y`.

The GitHub Release is marked "Latest" only when it moves the app's `:latest` image tag: a pre-release, a
backport or an older version never takes the badge.

## Cutting a release

1. A PR sets `version` and the notes. A pre-release keeps them under `## [Unreleased]`; a stable version
   renames `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and opens a new empty `## [Unreleased]` above it.
2. On the PR, `ci` runs `bun packages/release/src/cli.ts check`, and the `release` workflow does a dry run: it
   builds and smoke-tests the images without pushing and shows the notes it would publish in each `publish`
   job's summary.
3. Merging releases: the images, the floating tags, the tag `<app>-v<version>` and the GitHub Release (marked
   pre-release for a pre-release).

## A failed release

Actions → `release` → "Run workflow" on `main` (works from the phone): it plans again from the versions and
tags as they are. "Re-run failed jobs" is safe too: a released version is never tagged again and the floating
tags are recomputed when published.

## Notes are public

The changelog becomes the public Release notes. No names of people, teams, channels, hosts or work items from a
real installation.

## Locally

From the repository root:

```sh
bun packages/release/src/cli.ts check | plan | notes <app> <version> | floating <app> <version>
```
