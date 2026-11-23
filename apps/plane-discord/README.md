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

| Plane                                       | Supported | Checked on                                                    |
| ------------------------------------------- | --------- | ------------------------------------------------------------- |
| Plane Cloud                                 | yes       | 2026-11-23, a workspace on a Business-plan trial              |
| Commercial Edition, self-hosted, Free plan included | yes | v4.1.0                                                      |
| Community Edition                           | no        | —                                                             |

Plane Cloud publishes no version number. The Cloud Free plan was not checked. The Cloud check ran the app's install and
its main flows with the 0.1.0 release candidates, whose code 0.1.0 ships unchanged. The Commercial Edition version is
the one the maintainer's own installations run every day.

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

Register one app per Plane instance (workspace-level) and install it in each workspace. Fields:

- Setup URL `https://plane-discord.example.com/plane/setup?tenant=<id>`
- Redirect URI `https://plane-discord.example.com/plane/oauth/callback`
- Webhook URL `https://plane-discord.example.com/plane/webhook`
- Enable App Mentions
- Scopes: `projects:read`, `projects.work_items:read`, `projects.work_items:write`,
  `projects.work_items.comments:read`, `projects.work_items.comments:write`, `projects.states:read`,
  `projects.members:read`, `projects.modules:read`, `workspaces.members:read`, `agents.runs:read`,
  `agents.runs:write`, `agents.run_activities:read`, `agents.run_activities:write`

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

Set the interactions endpoint URL to `https://plane-discord.example.com/discord/interactions`. Enable the
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
