# @alxwlw/plane-app

The Plane App code the four apps (`plane-hooks`, `plane-discord`, `plane-miro`, `plane-graph`) share: the bot token of a workspace-level installation, and the install redirect and callback.
`src/index.ts` exports `botTokenAuth` (a cached bot token by `client_credentials`; every token request carries the registration's scopes), `PlaneAuthError` (a refused or failed token request; it never carries the response body), the types `PlaneAuth` and `Fetch`, `planeSetupRedirect` (`/plane/setup`: a 302 to the Plane consent screen) and `planeOauthCallback` (`/plane/oauth/callback`: prints `app_installation_id`, exchanges nothing).
Not published: a workspace package, used through `"workspace:*"`; images copy `src/` as it is.
