# @alxwlw/plane-kit

Modules the Plane apps (`plane-hooks`, `plane-discord`, `plane-miro`, `plane-graph`) share: `html`, `queue`, `rate`, `ttl`, `log`, `capture`, `locale` and `links`, plus `testing` (test-only helpers for the apps' guard tests: `findCyrillic`, `findCyrillicOutsideRu`, `expectEnglishOnly` and `CYRILLIC`; no `src/` file imports it).
Each is a subpath export (`@alxwlw/plane-kit/html`, …) that points at its TypeScript source; images copy `src/` as it is.
Not published: a workspace package, used through `"workspace:*"`.
`locale` exports `Locale` (`en`, `ru`), `LOCALES`, `DEFAULT_LOCALE` (`en`: the language of a tenant without `locale`) and `Catalog<T>`.
