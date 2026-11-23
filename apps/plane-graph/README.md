# plane-graph

A [Bun](https://bun.sh) service that keeps a read-only copy of the work items and relations of one or more
[Plane](https://plane.so) workspaces, draws the order in which the work can be done, and gives an agent the same
data to put missing relations back into Plane. It has no third-party runtime dependencies (it uses the workspace packages `@alxwlw/plane-app`, with bot-token auth and the install redirect, and `@alxwlw/plane-kit`, which the image carries as source), keeps its state in one SQLite file and serves its own
front end: `web/graph.ts` is bundled by `Bun.build` at start. The graph library (d3) is loaded by the browser
from a CDN with a pinned version and an integrity hash.

What it does:

- **A copy of Plane.** At start and daily at 03:00 UTC the service reads projects, states, labels, modules, all
  work items and the relations of each item, then swaps the copy in one transaction: a read that fails halfway
  leaves the old copy in place, logs `sync.failed` and is retried after 10 minutes. A webhook delivery re-reads
  the one item it names, with its relations; repeats of one item in the queue are folded into one read.
- **An order graph.** Work items joined by «blocks» are laid out in waves: wave 0 can start now, wave 1 waits for
  wave 0, and so on. Cycles are reported, not hidden; tasks of one wave that share an area label (`area:<name>`)
  are flagged as not parallel.
- **A block for Plane.** `plane-block.html` is a small file to put into an HTML block of a Plane page (pasted, or uploaded on Plane Cloud); it loads
  the graph from this service.
- **Agent endpoints.** `snapshot.json` is the whole copy, with `wave` and `inCycle` on each item and `cycles`
  computed the same way as in the graph (an item outside every «blocks» relation, a closed one and one in a cycle have `"wave": null`); `agent-runs` takes the list of relations and labels an
  agent has just added. The service confirms each one once it sees it in Plane, and reports the ones that
  disappeared afterwards under `rejected`. A label renamed in Plane keeps its marks: the next sync moves them to the
  new name, so a rename is not reported as rejected.

## Compatibility

plane-graph is a Plane App (OAuth, a bot token per workspace, signed webhooks). Plane Apps exist in Plane Cloud and in
the self-hosted Commercial Edition, its Free plan included. The open-source Community Edition (`makeplane/plane`)
has none, so plane-graph cannot run against it. Check a self-hosted instance with
`curl https://plane.example.com/api/instances/`: its `edition` must be `PLANE_COMMERCIAL`.

| Plane                                               | Supported | Checked on                                       |
| --------------------------------------------------- | --------- | ------------------------------------------------ |
| Plane Cloud                                         | yes       | 2026-11-23, a workspace on a Business-plan trial |
| Commercial Edition, self-hosted, Free plan included | yes       | v4.1.0                                           |
| Community Edition                                   | no        | —                                                |

Plane Cloud publishes no version number. The Cloud Free plan was not checked. The Cloud check ran the app's install and
its minimal scenario with the 0.1.0 release candidates, whose code 0.1.0 ships unchanged. The Commercial Edition version is
the one the maintainer's own installations run every day.

## Install checklist

Do the steps in this order. The Plane installation id exists only after the consent, so the first `tenants.json`
carries a placeholder for it (and for the workspace UUID, which step 6 reads from the log); until the id is real,
the first sync fails with `sync.failed`, which is expected. Below, `acme` is the tenant id, `example-ws` the Plane
workspace slug.

1. **Register the Plane App** ([Plane App](#plane-app) below) with the service's URLs and **Enable App Mentions**
   off. In the form's Webhook Secret put a secret from `openssl rand -hex 32` and keep it for
   `PLANE_GRAPH_ACME_WEBHOOK_SECRET`. Tick the scope grid, Read column only. Copy the **Client ID** and the
   **Client Secret** at once: the Secret is shown only in the "App created" dialog.
2. **Make the two keys**: the read key and the agent key, each from `openssl rand -hex 32`, and different (the
   service refuses equal keys and does not start). The read key opens the graph page; the agent key opens
   `snapshot.json` and `agent-runs`.
3. **Write a first `tenants.json`** in `config/` (`mkdir config && $EDITOR config/tenants.json`). Replace every
   value; `tenants.example.json` stays the full reference (it adds `locale` and `areaPrefix`). `workspaceId` and
   `installationId` are placeholders until step 6:

   ```json
   {
   	"tenants": [
   		{
   			"id": "acme",
   			"workspaceSlug": "example-ws",
   			"workspaceId": "00000000-0000-0000-0000-000000000000",
   			"clientId": "<Client ID from step 1>",
   			"installationId": "placeholder"
   		}
   	]
   }
   ```

   Where each value comes from: `workspaceSlug` is the slug in the Plane URL
   (`https://app.plane.so/<slug>/…`); `clientId` is from step 1; `workspaceId` and `installationId` are from step 6
   (the placeholders stay until then). The client secret, the webhook secret and the two keys go to the
   environment, not to this file.

4. **Start the service** with the Plane Cloud API and web addresses, the public URL and the secrets of steps 1 and 2. The public URL must be reachable over HTTPS from Plane and from the browsers that open the graph (a TLS
   reverse proxy in front of port 8080). The `tenants.json` is read only at start: any change to it, like a change
   of env, needs `docker rm -f plane-graph` and the command again.

   ```bash
   docker run -d --name plane-graph --restart unless-stopped \
     -p 8080:8080 \
     -v plane-graph-data:/data \
     -v "$PWD/config:/config:ro" \
     -e PLANE_GRAPH_PLANE_URL=https://api.plane.so \
     -e PLANE_GRAPH_PLANE_WEB_URL=https://app.plane.so \
     -e PLANE_GRAPH_PUBLIC_URL=https://plane-graph.example.com \
     -e PLANE_GRAPH_ACME_PLANE_SECRET='<Client Secret from step 1>' \
     -e PLANE_GRAPH_ACME_WEBHOOK_SECRET='<the Webhook Secret from step 1>' \
     -e PLANE_GRAPH_ACME_READ_KEY='<the read key from step 2>' \
     -e PLANE_GRAPH_ACME_AGENT_KEY='<the agent key from step 2>' \
     ghcr.io/alxwlw/plane-graph:0.1
   ```

   The same as a compose service (the secrets come from the shell or an `.env` file next to it):

   ```yaml
   services:
     plane-graph:
       image: ghcr.io/alxwlw/plane-graph:0.1
       container_name: plane-graph
       restart: unless-stopped
       ports: ['8080:8080']
       volumes:
         - plane-graph-data:/data
         - ./config:/config:ro
       environment:
         PLANE_GRAPH_PLANE_URL: https://api.plane.so
         PLANE_GRAPH_PLANE_WEB_URL: https://app.plane.so
         PLANE_GRAPH_PUBLIC_URL: https://plane-graph.example.com
         PLANE_GRAPH_ACME_PLANE_SECRET: ${PLANE_GRAPH_ACME_PLANE_SECRET}
         PLANE_GRAPH_ACME_WEBHOOK_SECRET: ${PLANE_GRAPH_ACME_WEBHOOK_SECRET}
         PLANE_GRAPH_ACME_READ_KEY: ${PLANE_GRAPH_ACME_READ_KEY}
         PLANE_GRAPH_ACME_AGENT_KEY: ${PLANE_GRAPH_ACME_AGENT_KEY}
   volumes:
     plane-graph-data:
   ```

   `container_name` keeps the commands below (`docker logs`, `docker rm -f`) the same for both ways. With compose,
   a change of `tenants.json` needs `docker compose restart plane-graph`; a change of env needs
   `docker compose up -d --force-recreate plane-graph`.

   You see the `listening` line with `"id":"acme"` in `docker logs plane-graph`, and
   `curl https://plane-graph.example.com/healthz` answers `ok`. A `sync.failed` line follows while the
   installation id is a placeholder, and repeats every 10 minutes until step 6. All variables are in [Configuration](#configuration); a wrong value stops the
   start with one message that names it.

5. **Open `https://plane-graph.example.com/plane/setup?tenant=acme`** in a browser logged in to Plane as a
   workspace admin. It redirects to the Plane consent screen. Plane's consent screen says the app "hasn't been
   reviewed or approved by Plane"; every private app shows it, so approve it. You land on a plain-text page that
   prints `app_installation_id=<uuid>`.
6. **Find the workspace UUID and put both ids in.** Plane Cloud shows the workspace UUID nowhere in its pages, but the
   service logs it: make any change in Plane (create a work item). On a new Plane Cloud workspace a product tour pops
   up over the work-item dialog the first time: close it. The service does not know the workspace yet, so
   `docker logs plane-graph` shows a line with `"event":"plane.rejected"`, `"reason":"unknown_workspace"` and
   `"workspaceId":"<uuid>"`. (Plane's API gives it too: `GET https://api.plane.so/auth/o/app-installation/?id=<installation id>`
   with the bot token answers `"workspace": "<uuid>"`; see
   [Plane's token flow](https://developers.plane.so/dev-tools/build-plane-app/choose-token-flow).) Put that UUID in
   `workspaceId` and the printed id in `installationId`, then **restart** the container (`docker rm -f plane-graph`
   and the command of step 4). The service reads Plane at start: `docker logs plane-graph` shows `sync.done` with the
   counts `projects`, `items` and `edges`. The sync itself needs only the installation id; the workspace UUID is
   what the service matches Plane's webhook deliveries against.
7. **Check.** The minimal scenario: the page shows the workspace's graph after the first sync, and `snapshot.json`
   answers with the agent key.
   - In Plane create two work items and set a «blocking» relation on the first one, so that it blocks the second
     (close the product tour, as in step 6). A webhook delivery refreshes the copy; a restart of the container
     reads everything again at once.
   - Open `https://plane-graph.example.com/t/acme/graph?k=<read key>`: both items are there, in two waves, the
     blocking one first.
   - `curl -H "Authorization: Bearer <agent key>" https://plane-graph.example.com/t/acme/snapshot.json` answers
     `200` with the items, the first with `"wave": 0`, the second with `"wave": 1`. Without the header, or with the
     read key, it answers `401`.
8. **Optional: put the graph into a Plane page** ([Putting the graph into Plane](#putting-the-graph-into-plane)).

## Routes

| Path                                       | Purpose                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `POST /plane/webhook`                      | Plane App webhook, signed with the app's webhook secret                          |
| `GET /plane/setup`                         | `?tenant=<id>`: redirects to the Plane consent screen of the app                 |
| `GET /plane/oauth/callback`                | Prints the `app_installation_id` for `tenants.json`                              |
| `GET /t/<tenant>/graph?k=<read key>`       | The graph page                                                                   |
| `GET /t/<tenant>/graph.json?k=<key>`       | The graph data (`Cache-Control: no-store`, CORS `*`)                             |
| `GET /t/<tenant>/plane-block.html?k=<key>` | The file for a Plane HTML block, sent as an attachment                           |
| `GET /assets/graph.js`                     | The bundled front end, no key                                                    |
| `GET /t/<tenant>/snapshot.json`            | The whole copy plus waves and cycles; `Authorization: Bearer <agent key>`        |
| `POST /t/<tenant>/agent-runs`              | A run of the agent, a JSON body up to 1 MiB; `Authorization: Bearer <agent key>` |
| `GET /healthz`                             | `ok`                                                                             |

The read key opens the graph only; the agent key opens `snapshot.json` and `agent-runs` only. Keys are compared in
constant time. An unknown tenant is `404`; a wrong, missing or empty key is `401 {"error":"unauthorized"}`.
`POST /plane/webhook` always answers `200`, accepted or not: a non-2xx counts as a failure at Plane, and after
five of them Plane disables the webhook. What cannot be accepted (bad signature, unknown workspace, broken JSON,
a body over 4 MiB) is logged with `level: "error"` and `event: "plane.rejected"`.

## Watchdog

Every 15 minutes, for each tenant (a failure of one never stops the others), log lines only:

- **Plane silence.** No delivery for 72 hours (counted from the start for a tenant that never had one) logs
  `plane.silent` at `error` once; the first delivery after that logs `plane.alive`.
- **Stale copy.** The last successful reconcile older than 26 hours logs `watchdog.stale_sync` at `error`, at most
  once a day per tenant. A copy never synced is counted from the start.

The watchdog keeps its alerts in memory, so a restart may repeat one. Once an hour the deduplication keys older
than 30 days are deleted.

## Reconcile

One timer per tenant, and the reconcile runs as a job of the tenant's queue, never beside a refresh of one item.
After a success the next one is at 03:00 UTC; after a failure, in 10 minutes. When a refreshed item names a state
or project the copy does not know, the next reconcile is moved to 10 minutes after the last one finished (or to
now, if that was longer ago); asking again while one is queued or running changes nothing. Reads are limited to
300 requests a minute per tenant. Webhook refreshes wait behind a running reconcile, about 3 minutes at start, at
03:00 UTC and after every restart; the copy catches up when it ends.

## Configuration

Environment:

| Variable                          | Required | Meaning                                                                                                       |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `PLANE_GRAPH_PLANE_URL`           | yes      | Plane API base URL, e.g. `https://plane.example.com`; on Plane Cloud `https://api.plane.so`                   |
| `PLANE_GRAPH_PLANE_WEB_URL`       | no       | Plane web address for work-item links; default `PLANE_GRAPH_PLANE_URL`; on Plane Cloud `https://app.plane.so` |
| `PLANE_GRAPH_PUBLIC_URL`          | yes      | Public URL of this service, e.g. `https://plane-graph.example.com`                                            |
| `PLANE_GRAPH_<ID>_PLANE_SECRET`   | yes      | Per tenant: client secret of the Plane App                                                                    |
| `PLANE_GRAPH_<ID>_WEBHOOK_SECRET` | yes      | Per tenant: webhook secret of the Plane App                                                                   |
| `PLANE_GRAPH_<ID>_READ_KEY`       | yes      | Per tenant: the key of the graph URLs (`openssl rand -hex 32`)                                                |
| `PLANE_GRAPH_<ID>_AGENT_KEY`      | yes      | Per tenant: the agent's bearer key; must differ from the read key                                             |
| `PLANE_GRAPH_CONFIG`              | no       | Tenants file, default `/config/tenants.json`                                                                  |
| `PLANE_GRAPH_DB`                  | no       | SQLite file, default `/data/plane-graph.sqlite`                                                               |
| `PORT`                            | no       | Listen port, default `8080`                                                                                   |

`<ID>` is the tenant id in upper case. A missing or malformed value stops the start with one message listing
every problem; the message names variables and JSON paths, never values. A failed build of `web/` stops it too.

Tenants: [`tenants.example.json`](tenants.example.json) shows every key (tenant id, Plane workspace slug and its
UUID, the Plane App's client id and installation id, `locale`, `areaPrefix`). The tenant id matches `^[a-z][a-z0-9]{0,15}$`. UUIDs may be
written in any case: they are read in lower case, as Plane sends them.

`locale` is `en` (the default) or `ru`. Every text of the page is in the tenant's language; logs and startup errors are English. A request whose tenant is unknown is answered in English. A change takes effect after a restart.

`areaPrefix` is the prefix of the labels that name an area, default `area:`, matched case-sensitively as written. A team whose area labels are `код:<name>` sets `"areaPrefix": "код:"`.

## Plane App

Register one app per Plane instance and install it in each workspace
([Plane docs: create an OAuth application](https://developers.plane.so/dev-tools/build-plane-app/create-oauth-application)).
On Plane Cloud the form opens directly at `https://app.plane.so/<workspace-slug>/settings/integrations/create/`
(`https://app.plane.so/example-ws/settings/integrations/create/` for the example workspace), titled "Build your own app".
On the Commercial Edition click through the sidebar instead: in Plane open **Workspace settings** and click
**Integrations** in the settings sidebar, then **Apps**, then the **Build your own** link. The form asks for these
fields, in this order (`*` is required on Plane Cloud):

| Field                              | Value                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload Logo                        | optional                                                                                                                                                                                                                              |
| App Name \*                        | anything, for example `plane-graph-acme`                                                                                                                                                                                              |
| App slug \*                        | for example `plane-graph-acme`                                                                                                                                                                                                        |
| App Maker \*                       | the person or organization creating the app, for example `acme`                                                                                                                                                                       |
| Short Description \*               | for example `Draws the order of work items from their blocking relations`                                                                                                                                                             |
| Long Description \*                | a rich-text paragraph, for example the first paragraph of this README                                                                                                                                                                 |
| Website                            | optional                                                                                                                                                                                                                              |
| Connection Type                    | choose **Workspace-Level Connection** (Plane Cloud's form starts on User-Level Connection): the app is installed once per workspace and acts as a bot, not as a person. On the Commercial Edition leave **User-Level Connection** off |
| Enable App Mentions                | off                                                                                                                                                                                                                                   |
| Setup URL                          | `https://plane-graph.example.com/plane/setup?tenant=<id>`                                                                                                                                                                             |
| Webhook URL                        | `https://plane-graph.example.com/plane/webhook`                                                                                                                                                                                       |
| Webhook Secret                     | the form issues none: a secret of your own (`openssl rand -hex 32`), kept for `PLANE_GRAPH_<ID>_WEBHOOK_SECRET`                                                                                                                       |
| Redirect URIs (space separated) \* | `https://plane-graph.example.com/plane/oauth/callback`                                                                                                                                                                                |
| Scopes (**Scopes & Permissions**)  | the grid below, Read column only                                                                                                                                                                                                      |

The collapsed sections (Categorisation, Supported Plans, Compliance & Support, Additional resources) are all
optional: leave them as they are (Supported Plans: leave empty, which allows all plans).

The scopes are a grid with a Read and a Write column, not machine names: tick the Read cell of each row below and
no Write cell. The rows are in the grid's **Projects** section.

| Row in the grid     | Read | Write | Scope names                          |
| ------------------- | ---- | ----- | ------------------------------------ |
| Projects            | yes  | no    | `projects:read`                      |
| Project States      | yes  | no    | `projects.states:read`               |
| Project Labels      | yes  | no    | `projects.labels:read`               |
| Modules             | yes  | no    | `projects.modules:read`              |
| Work Items          | yes  | no    | `projects.work_items:read`           |
| Work Item Relations | yes  | no    | `projects.work_items.relations:read` |

Installing the app through the setup URL ends on the callback page, which
prints `app_installation_id=<uuid>`; put it in `tenants.json`.

The id exists only after that consent, but the service does not start without the key
(`tenants[0].installationId must be a non-empty string`), and `/plane/setup` uses only the app's client id from the
tenant. So start with the real `clientId` and `"installationId": "placeholder"` (nothing checks the shape; the
first sync then fails with `sync.failed`), run the setup URL, then replace the placeholder with the printed id and
restart the container.

## Putting the graph into Plane

Open `https://plane-graph.example.com/t/<tenant>/plane-block.html?k=<read key>`: the browser saves
`plane-graph.html`. Put it into a Plane page: in an editor with an HTML block paste its content there; on Plane
Cloud the slash command **HTML artifact** takes the saved file as an upload (there is nothing to paste). The block loads
`/assets/graph.js` and the graph data from this service, so the page must be able to reach it. The page of the
graph itself is `https://plane-graph.example.com/t/<tenant>/graph?k=<read key>`; a work item shows as its key,
for instance `ABC-1`, and opens in Plane.

Plane sandboxes the HTML block, and a task opened by a plain click there would show a blank tab. Inside the block
a plain click on a task therefore shows a hint; Ctrl/⌘+click or the middle mouse button opens the task.

## Operations

- **Logs** are one JSON line per event on stdout: `{ts, event, tenant?, …ids, ms?, error?}`. Secrets, keys,
  tokens and the titles and descriptions of work items never reach them. There is no access log: failures are
  logged by route; no query string or header is logged.
- **State** is one SQLite file (`/data`, a named volume): deduplication keys, the copy, the agent's runs and
  marks, the watchdog heartbeat. Losing it costs the history of the agent's runs and the deduplication window;
  the next reconcile rebuilds the copy from Plane.
- **Queue** is in memory, one per tenant: a restart drops the events not yet handled, and the reconcile at start
  covers them. A retryable failure is retried after 1 s, 5 s and 30 s.

## Image

Releases are published as `:<version>` (for example `:0.1.0`), `:0.1` and `:latest`, each for `linux/amd64` and
`linux/arm64`; the notes are in [CHANGELOG.md](CHANGELOG.md) and on the GitHub Release `plane-graph-v<version>`. Use
`:0.1`: it takes patch releases only, because a breaking configuration change raises the minor version and its
changelog entry says how to upgrade. Pin `:0.1.0` (or its digest) to stay on one release. `:latest` follows every
release, breaking ones included: do not use it for unattended updates.

`ghcr.io/alxwlw/plane-graph` for `linux/amd64` and `linux/arm64`, built through `.github/workflows/image.yml`:
releases by `.github/workflows/release.yml`, and development builds (the tags `main` and `<commit sha>`, not releases)
by `.github/workflows/plane-graph-image.yml` on every push to `main` that touches this directory or a package it
ships. Each platform is smoke-tested on its own runner by `.github/smoke/plane-graph.sh` before publishing
(`/healthz`, the bundle, the `listening` line, the SQLite file in `/data`).

The build context is the repository root: the image carries `packages/plane-app` and `packages/plane-kit` as source and installs nothing.

```bash
docker build -f apps/plane-graph/Dockerfile -t plane-graph:local .
.github/smoke/plane-graph.sh plane-graph:local
```
