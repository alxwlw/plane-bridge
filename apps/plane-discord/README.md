# plane-discord

A [Bun](https://bun.sh) service that bridges [Plane](https://plane.so) and Discord for one or more
tenants (a Discord server plus a Plane workspace each). It has no third-party runtime dependencies (it uses the workspace packages `@alxwlw/plane-app` and `@alxwlw/plane-kit`, which the image carries as source) and keeps its
state in one SQLite file.

Phases 1 to 3 (this version; a bound thread and its work item are synced both ways):

- **1a, Plane to a channel.** A work item is created, closed or cancelled, or the bot is mentioned in a
  comment: a message goes to the Discord channel mapped to the project (and optionally a module). A
  forum channel gets one post per work item named `KEY Title`; later events go to the same post. A text
  channel gets plain messages. No mapping, no message.
- **1b, Plane to a DM.** "You were assigned" and "you were mentioned" reach the person through the
  user table. Your own actions are not sent. A closed DM is logged, not retried.
- **1c, Discord to Plane.** The message commands `Create Plane work item` (opens a modal, creates the
  work item with `external_source=discord`, `external_id=<message id>`, replies in the channel) and
  `Add to work item` (adds a comment to a work item by key). Attachments go in as links.
- **2, `/plane KEY`.** A slash command that answers in the channel with a public card of the work item
  (title, state, assignees, priority, link). A malformed key, an unknown key and a key of a hidden
  project get a private (ephemeral) reply; the last two look the same.
- **3, thread binding.** When `Create Plane work item` creates a work item in a text or announcement
  channel, the bot opens a thread on its public reply and binds it to the item (a forum post from 1a is
  already bound). `/plane-link KEY` binds the thread it is typed in; a thread holds one work item.
  Binding a thread to a hidden project's item is refused like an unknown key.
  `/plane-link` makes the bot join the thread; in a private thread @Plane must be added first.
  A message in a bound thread becomes a Plane comment `Name (Discord): …` with a link to the message
  (`external_source=discord`, `external_id=<message id>`; a repeat adds nothing). The bot's own messages,
  its webhooks' messages and system messages are skipped; edits and deletions are not synced. This needs the
  privileged `MESSAGE_CONTENT` intent enabled in the Developer Portal: without it the Gateway closes with
  4014 and only thread sync stops (the log says `gateway.fatal`); the other phases keep working. Items of
  hidden projects are never synced.
  A comment by a person in Plane goes to every thread bound to the item, through a webhook the bot creates
  in the thread's parent channel (needs Manage Webhooks), under the author's Plane name and, when Plane gives
  an `https` URL (or a path from the Plane root, joined to `PLANE_DISCORD_PLANE_URL`), avatar (`discord` and `clyde` are cut from the name, empty → `Plane`). People
  mentioned in the comment appear as `<@id>` or `@name`, but the message never pings. Comments of the bot itself are
  not sent, and a bot mention in a channel where the item already has a thread is not repeated as a 1a message.
  A deleted webhook is created again once per delivery. A deleted thread (any 4xx but 429 with code 10003; live
  Discord answers 400) is unbound with `notify.thread_gone`; a 5xx or a transport error is retried.

Hidden projects (`hiddenProjects`) are hidden completely: no channel topics, no DMs, no modal, no
forwarded mentions.

## Compatibility

plane-discord is a Plane App (OAuth, a bot token per workspace, signed webhooks). Plane Apps exist in Plane Cloud and in
the self-hosted Commercial Edition, its Free plan included. The open-source Community Edition (`makeplane/plane`)
has none, so plane-discord cannot run against it. Check a self-hosted instance with
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

Do the steps in this order. The service does not start without the Discord credentials, so the Discord application
comes first; Discord saves the Interactions Endpoint URL only after the running service answers its signed PING, so
that field waits until the service is up; and the Plane installation id exists only after the consent, so the first
`tenants.json` carries a placeholder for it (and for the workspace UUID, which step 9 reads from the log). Below,
`acme` is the tenant id, `example-ws` the Plane workspace slug.

1. **Register the Plane App** ([Plane App](#plane-app) below) with the service's URLs and **Enable App Mentions** on.
   In the form's Webhook Secret put a secret from `openssl rand -hex 32` and keep it for
   `PLANE_DISCORD_ACME_WEBHOOK_SECRET`: the service requires it, separate from the client secret
   (`src/config.ts:293`). Tick the scope grid. Copy the **Client ID** and the **Client Secret** at once: the Secret
   is shown only in the "App created" dialog.
2. **Create the Discord application** ([Discord app](#discord-app) below) in the Discord Developer Portal, with a
   name without `discord` or `clyde`. On **General Information** copy the Application ID and the Public Key. On
   **Bot** press **Reset Token** and copy the bot token (Discord may ask for 2FA); turn on the `MESSAGE_CONTENT`
   intent. Leave the Interactions Endpoint URL empty for now: Discord checks it against the running service
   (step 6).
3. **Invite the bot** to your server with the invite URL of [Discord app](#discord-app) below.
4. **Write a first `tenants.json`** in `config/` (`mkdir config && $EDITOR config/tenants.json`). Replace every
   value; `tenants.example.json` stays the full reference. `workspaceId` and `appInstallationId` are placeholders
   until step 9:

   ```json
   {
   	"tenants": [
   		{
   			"id": "acme",
   			"guildId": "111111111111111111",
   			"workspace": "example-ws",
   			"workspaceId": "00000000-0000-0000-0000-000000000000",
   			"plane": { "clientId": "<Client ID from step 1>", "appInstallationId": "placeholder" },
   			"serviceChannelId": "222222222222222222",
   			"channels": [
   				{
   					"channelId": "333333333333333333",
   					"projectId": "00000000-0000-4000-8000-000000000003",
   					"moduleId": null
   				}
   			],
   			"users": []
   		}
   	]
   }
   ```

   Where each value comes from:
   - `guildId`, `serviceChannelId`, `channels[].channelId`: in Discord, **User Settings → Advanced → Developer Mode**
     on, then right-click the server or the channel → **Copy Server ID** / **Copy Channel ID**. Once the service
     runs, `scripts/list-channels.ts` lists them too ([Scripts](#scripts)).
   - `workspace`: the slug in the Plane URL (`https://app.plane.so/<slug>/…`).
   - `channels[].projectId`: the project's UUID, in the project's URL
     (`https://app.plane.so/<slug>/projects/<uuid>/issues/`). The project's settings page does not show it.
   - `plane.clientId`: step 1. `workspaceId` and `appInstallationId`: step 9 (the placeholders stay until then).
   - The Application ID, the Public Key and the bot token go to the environment, not to this file: step 2.

5. **Start the service** with the Plane Cloud API address, the public URL and the secrets of steps 1 and 2. The
   public URL must be reachable over HTTPS from Discord and from Plane (a TLS reverse proxy in front of port 8080).
   The `tenants.json` is read only at start: any change to it, like a change of env, needs
   `docker rm -f plane-discord` and the command again.

   ```bash
   docker run -d --name plane-discord --restart unless-stopped \
     -p 8080:8080 \
     -v plane-discord-data:/data \
     -v "$PWD/config:/config:ro" \
     -e PLANE_DISCORD_PLANE_URL=https://api.plane.so \
     -e PLANE_DISCORD_PLANE_WEB_URL=https://app.plane.so \
     -e PLANE_DISCORD_PUBLIC_URL=https://plane-discord.example.com \
     -e PLANE_DISCORD_DISCORD_APPLICATION_ID='<Application ID from step 2>' \
     -e PLANE_DISCORD_DISCORD_PUBLIC_KEY='<Public Key from step 2>' \
     -e PLANE_DISCORD_DISCORD_BOT_TOKEN='<bot token from step 2>' \
     -e PLANE_DISCORD_ACME_PLANE_SECRET='<Client Secret from step 1>' \
     -e PLANE_DISCORD_ACME_WEBHOOK_SECRET='<the Webhook Secret from step 1>' \
     ghcr.io/alxwlw/plane-discord:0.1
   ```

   The same as a compose service (the secrets come from the shell or an `.env` file next to it):

   ```yaml
   services:
     plane-discord:
       image: ghcr.io/alxwlw/plane-discord:0.1
       restart: unless-stopped
       ports: ['8080:8080']
       volumes:
         - plane-discord-data:/data
         - ./config:/config:ro
       environment:
         PLANE_DISCORD_PLANE_URL: https://api.plane.so
         PLANE_DISCORD_PLANE_WEB_URL: https://app.plane.so
         PLANE_DISCORD_PUBLIC_URL: https://plane-discord.example.com
         PLANE_DISCORD_DISCORD_APPLICATION_ID: ${PLANE_DISCORD_DISCORD_APPLICATION_ID}
         PLANE_DISCORD_DISCORD_PUBLIC_KEY: ${PLANE_DISCORD_DISCORD_PUBLIC_KEY}
         PLANE_DISCORD_DISCORD_BOT_TOKEN: ${PLANE_DISCORD_DISCORD_BOT_TOKEN}
         PLANE_DISCORD_ACME_PLANE_SECRET: ${PLANE_DISCORD_ACME_PLANE_SECRET}
         PLANE_DISCORD_ACME_WEBHOOK_SECRET: ${PLANE_DISCORD_ACME_WEBHOOK_SECRET}
   volumes:
     plane-discord-data:
   ```

   You see the `listening` line with `"id":"acme"` in `docker logs plane-discord`, and
   `curl https://plane-discord.example.com/healthz` answers `ok`. All variables are in
   [Configuration](#configuration); a wrong value stops the start with one message that names it.

6. **Set the Interactions Endpoint URL** in the Developer Portal (**General Information**) to
   `https://plane-discord.example.com/discord/interactions` and save: Discord saves it only when the service
   answers its signed PING, which is why this step comes after step 5.
7. **Register the commands**: `docker exec plane-discord bun scripts/register-commands.ts` prints
   `✓ acme en 4 commands` (the two message commands `Create Plane work item` and `Add to work item`, `/plane` and
   `/plane-link`).
8. **Open `https://plane-discord.example.com/plane/setup?tenant=acme`** in a browser logged in to Plane as a
   workspace admin. It redirects to the Plane consent screen. Plane's consent screen says the app "hasn't been
   reviewed or approved by Plane"; every private app shows it, so approve it. You land on a plain-text page that
   prints `app_installation_id=<uuid>`.
9. **Find the workspace UUID and put both ids in.** Plane Cloud shows the workspace UUID nowhere in its pages, but the
   service logs it: make any change in Plane (create a work item). On a new Plane Cloud workspace a product tour pops
   up over the work-item dialog the first time: close it. The service does not know the workspace yet, so
   `docker logs plane-discord` shows a line with `"event":"plane.rejected"`, `"reason":"unknown_workspace"` and
   `"workspaceId":"<uuid>"`. (Plane's API gives it too: `GET https://api.plane.so/auth/o/app-installation/?id=<installation id>`
   with the bot token answers `"workspace": "<uuid>"`; see
   [Plane's token flow](https://developers.plane.so/dev-tools/build-plane-app/choose-token-flow).) Put that UUID in
   `workspaceId` and the printed id in `plane.appInstallationId`, then **restart** the container
   (`docker rm -f plane-discord` and the command of step 5). The `listening` line appears again and `/healthz`
   answers `ok`.
10. **Check.** The minimal scenario: a Plane event reaches the channel, a message becomes a work item, and `/plane KEY`
    shows the card.
    - Create a work item in the mapped project (close the product tour, as in step 9): a post appears in the mapped
      channel, and the log shows `plane.accepted`.
    - On a Discord message open **Apps → Create Plane work item**, fill the form: the work item exists in Plane and
      the bot replies with its link.
    - Type `/plane <KEY>` with the key of that work item (for example `ENG-1`): the bot answers with the card.

## Routes

| Path                         | Purpose                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `POST /plane/webhook`        | Plane App webhook, signed with the app's webhook secret                |
| `GET /plane/setup`           | `?tenant=<id>`: redirects to the Plane consent screen of the app       |
| `GET /plane/oauth/callback`  | Prints the `app_installation_id` for `tenants.json`; exchanges nothing |
| `POST /discord/interactions` | Discord interactions endpoint, Ed25519-verified                        |
| `GET /healthz`               | `ok`                                                                   |

`POST /plane/webhook` always answers `200`, accepted or not: a non-2xx counts as a failure at Plane,
and after five of them Plane disables the webhook. What cannot be accepted (bad signature, unknown
workspace, broken JSON, a body over 4 MiB) is logged with `level: "error"` and `event: "plane.rejected"`.

## Silence watchdog

Plane does not expose a webhook's status to a bot token (the call answers 403), so the service judges
by silence alone. Every 15 minutes, for each tenant: no delivery for longer than `silenceHours` (counted
from the start for a tenant that never had one) posts one message to `serviceChannelId` and logs
`plane.silent` at `error`. The first delivery after that posts "Plane is sending events again" and logs `plane.alive`.
Without a `serviceChannelId` only the log lines are written.

## Configuration

Environment:

| Variable                               | Required | Meaning                                                                                                         |
| -------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `PLANE_DISCORD_PLANE_URL`              | yes      | Plane API base URL, e.g. `https://plane.example.com`; on Plane Cloud `https://api.plane.so`                     |
| `PLANE_DISCORD_PLANE_WEB_URL`          | no       | Plane web address for work-item links; default `PLANE_DISCORD_PLANE_URL`; on Plane Cloud `https://app.plane.so` |
| `PLANE_DISCORD_PUBLIC_URL`             | yes      | Public URL of this service, e.g. `https://plane-discord.example.com`                                            |
| `PLANE_DISCORD_DISCORD_APPLICATION_ID` | yes      | Discord application id                                                                                          |
| `PLANE_DISCORD_DISCORD_PUBLIC_KEY`     | yes      | Discord public key, 64 hex digits                                                                               |
| `PLANE_DISCORD_DISCORD_BOT_TOKEN`      | yes      | Discord bot token                                                                                               |
| `PLANE_DISCORD_<ID>_PLANE_SECRET`      | yes      | Per tenant: client secret of the Plane App                                                                      |
| `PLANE_DISCORD_<ID>_WEBHOOK_SECRET`    | yes      | Per tenant: webhook secret of the Plane App                                                                     |
| `PLANE_DISCORD_CONFIG`                 | no       | Tenants file, default `/config/tenants.json`                                                                    |
| `PLANE_DISCORD_DB`                     | no       | SQLite file, default `/data/plane-discord.sqlite`                                                               |
| `PORT`                                 | no       | Listen port, default `8080`                                                                                     |

`<ID>` is the tenant id in upper case. A missing or malformed value stops the start with one message
listing every problem; the message names variables and JSON paths, never values.

Tenants: [`tenants.example.json`](tenants.example.json) shows every key (tenant id, Discord server,
Plane workspace and its UUID, the app's client id and installation id, the service channel, the channel
map with optional module and event set, the user table, hidden projects, `locale`). The tenant id matches
`^[a-z][a-z0-9]{0,15}$`.

`locale` is `en` (the default) or `ru`. Every text the bot writes (channel posts, cards, notifications, DMs, replies and command names) is in the tenant's language; logs, startup errors and the operator scripts are English. A request whose tenant is unknown is answered in English. A change takes effect after a restart.

`scripts/register-commands.ts` registers each guild's commands in its tenant's language (`Create Plane work item`, `Add to work item` for `en`; `Создать задачу в Plane`, `Добавить в задачу` for `ru`); run it again after changing `locale`. The service accepts both languages' command names, so commands registered earlier keep working.

## Plane App

Register one app per Plane instance and install it in each workspace
([Plane docs: create an OAuth application](https://developers.plane.so/dev-tools/build-plane-app/create-oauth-application)).
On Plane Cloud the form opens directly at `https://app.plane.so/<workspace-slug>/settings/integrations/create/`
(`https://app.plane.so/example-ws/settings/integrations/create/` for the example workspace), titled "Build your own app".
On the Commercial Edition click through the sidebar instead: in Plane open **Workspace settings** and click
**Integrations** in the settings sidebar, then **Apps**, then the **Build your own** link. The form asks for these
fields, in this order (`*` is required on Plane Cloud):

| Field                              | Value                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload Logo                        | optional                                                                                                                                                                |
| App Name \*                        | anything, for example `plane-discord-acme`                                                                                                                              |
| App slug \*                        | for example `plane-discord-acme`                                                                                                                                        |
| App Maker \*                       | the person or organization creating the app, for example `acme`                                                                                                         |
| Short Description \*               | for example `Bridges Plane work items and Discord channels`                                                                                                             |
| Long Description \*                | a rich-text paragraph, for example the first paragraph of this README                                                                                                   |
| Website                            | optional                                                                                                                                                                |
| Connection Type                    | choose **Workspace-Level Connection** (Plane Cloud's form starts on User-Level Connection): the app is installed once per workspace and acts as a bot, not as a person. |
| Enable App Mentions                | on                                                                                                                                                                      |
| Setup URL                          | `https://plane-discord.example.com/plane/setup?tenant=<id>`                                                                                                             |
| Webhook URL                        | `https://plane-discord.example.com/plane/webhook`                                                                                                                       |
| Webhook Secret                     | the form issues none: a secret of your own (`openssl rand -hex 32`), kept for `PLANE_DISCORD_<ID>_WEBHOOK_SECRET`                                                       |
| Redirect URIs (space separated) \* | `https://plane-discord.example.com/plane/oauth/callback`                                                                                                                |
| Scopes (**Scopes & Permissions**)  | the grid below                                                                                                                                                          |

The collapsed sections (Categorisation, Supported Plans, Compliance & Support, Additional resources) are all
optional: leave them as they are (Supported Plans: leave empty, which allows all plans).

The scopes are a grid with a Read and a Write column, not machine names: tick, per row, the cells below. The rows
are in the grid's **Projects**, **Workspaces** and **Agents** sections. Each of the 13 scope names the service
requests is one cell:

| Row in the grid      | Read | Write | Scope names                                                 |
| -------------------- | ---- | ----- | ----------------------------------------------------------- |
| Projects             | yes  | no    | `projects:read`                                             |
| Project Members      | yes  | no    | `projects.members:read`                                     |
| Project States       | yes  | no    | `projects.states:read`                                      |
| Modules              | yes  | no    | `projects.modules:read`                                     |
| Work Items           | yes  | yes   | `projects.work_items:read`, `projects.work_items:write`     |
| Work Item Comments   | yes  | yes   | `projects.work_items.comments:read`, `…comments:write`      |
| Workspace Members    | yes  | no    | `workspaces.members:read`                                   |
| Agent Runs           | yes  | yes   | `agents.runs:read`, `agents.runs:write`                     |
| Agent Run Activities | yes  | yes   | `agents.run_activities:read`, `agents.run_activities:write` |

Plane does not take the scopes from the registration, so the service sends them (space-separated) as the
`scope` parameter of the consent URL and of every token request.

Installing the app through the setup URL ends on the callback page, which prints
`app_installation_id=<uuid>`; put it in `tenants.json`.

The id exists only after that consent, but the service does not start without the key
(`plane.appInstallationId must be a non-empty string`), and `/plane/setup` uses only `plane.clientId`. So start with the
real `clientId` and `"appInstallationId": "placeholder"` (nothing checks the shape), run the setup URL, then replace the
placeholder with the printed id and restart the container.

## Discord app

Name it without `discord` or `clyde`. Invite the bot with the permission integer `309774601216`
(view channels, send messages, embed links, read history, manage webhooks, create public threads, send
in threads):

```text
https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot+applications.commands&permissions=309774601216&guild_id=<GUILD>&disable_guild_select=true
```

Set the interactions endpoint URL to `https://plane-discord.example.com/discord/interactions` only after the
service is running (checklist step 6): Discord saves it only when the service answers its signed PING. Enable the
privileged `MESSAGE_CONTENT` intent in the Developer Portal (Bot, Privileged Gateway Intents): thread sync
(phase 3) needs it; without it only thread sync stops.

## Scripts

Run inside the container with the service's environment:

```bash
docker exec <container> bun scripts/register-commands.ts   # overwrites the guild commands of every tenant
docker exec <container> bun scripts/list-channels.ts       # id, type, parent and name of every channel
```

## Operations

- **Logs** are one JSON line per event on stdout: `{ts, event, tenant?, …ids, ms?, error?}`. Secrets and
  the text of messages, descriptions and comments never reach them.
- **State** is one SQLite file (`/data`, a named volume): deduplication keys, links between work items and
  Discord threads or messages, the ids and tokens of the webhooks the bot created for thread messages, the
  watchdog heartbeat. It is not backed up. Losing it costs the deduplication window (a retried delivery can
  post twice), the thread links of existing posts (new events open new posts) and the links of threads bound
  by `Create Plane work item` or `/plane-link`: their sync stops until `/plane-link` is run again. The bot
  adopts its own webhook found in a channel, or creates a new one; webhooks created earlier stay in the
  channels (Discord allows 15 per channel, so remove stale ones by hand). Nothing in Plane or Discord is
  lost.
- **Queue** is in memory: a restart drops the deliveries not yet sent. A Discord form open in a modal is
  also in memory; after a restart it answers "The form has expired, run the command again.", and the command is run again.

## Image

Releases are published as `:<version>` (for example `:0.1.0`), `:0.1` and `:latest`, each for `linux/amd64` and
`linux/arm64`; the notes are in [CHANGELOG.md](CHANGELOG.md) and on the GitHub Release `plane-discord-v<version>`. Use
`:0.1`: it takes patch releases only, because a breaking configuration change raises the minor version and its
changelog entry says how to upgrade. Pin `:0.1.0` (or its digest) to stay on one release. `:latest` follows every
release, breaking ones included: do not use it for unattended updates.

`ghcr.io/alxwlw/plane-discord` for `linux/amd64` and `linux/arm64`, built through `.github/workflows/image.yml`:
releases by `.github/workflows/release.yml`, and development builds (the tags `main` and `<commit sha>`, not releases)
by `.github/workflows/plane-discord-image.yml` on every push to `main` that touches this directory or a package it
ships. Each platform is smoke-tested on its own runner by `.github/smoke/plane-discord.sh` before publishing
(`/healthz`, the `listening` line, the SQLite file in `/data`).

```bash
docker build -f apps/plane-discord/Dockerfile -t plane-discord:local .
.github/smoke/plane-discord.sh plane-discord:local
```
