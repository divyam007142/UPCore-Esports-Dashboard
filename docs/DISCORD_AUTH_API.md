# Discord login and staff activity API

The dashboard now uses a same-origin `/api` path. In production, Cloudflare
Pages proxies that path to the Render API, so Discord OAuth and session cookies
must be implemented by the Render service, not in the Vite client.

The browser never receives the Discord client secret or the bot token.

## 1. Discord Developer Portal setup

In the Discord Developer Portal, open the application used by the bot and add
these OAuth2 redirect URLs:

```text
https://upcore-esports-dashboard.pages.dev/api/auth/discord/callback
https://<your-dev-domain>/api/auth/discord/callback
```

The second URL is optional but useful while testing. Use the exact hostname
shown by the Replit preview.

Configure these Render environment variables through the service's secret
manager:

```text
DISCORD_CLIENT_ID=<OAuth application client ID>
DISCORD_CLIENT_SECRET=<OAuth application client secret>
DISCORD_REDIRECT_URI=https://upcore-esports-dashboard.pages.dev/api/auth/discord/callback
SESSION_SECRET=<long random value>
DASHBOARD_ORIGIN=https://upcore-esports-dashboard.pages.dev
```

The existing bot token remains server-only. Do not put any of these values in
Vite variables or commit them to the repository.

Use OAuth scopes `identify` and `guilds`. After Discord returns the user, keep
only guilds where the user has `MANAGE_GUILD` or `ADMINISTRATOR`, and ideally
also require that the bot is present in the guild.

## 2. Required auth routes

The dashboard calls these routes through `/api`:

### `GET /api/auth/discord`

Redirect to Discord's authorize URL:

```text
https://discord.com/oauth2/authorize
  ?client_id=DISCORD_CLIENT_ID
  &redirect_uri=DISCORD_REDIRECT_URI
  &response_type=code
  &scope=identify%20guilds
  &state=<signed-one-time-state>
```

The `state` value must be signed, short-lived, and bound to the requested
`returnTo` URL. Do not accept an arbitrary return URL after the callback.

### `GET /api/auth/discord/callback`

1. Verify `state`.
2. Exchange `code` at `https://discord.com/api/oauth2/token`.
3. Fetch `GET https://discord.com/api/users/@me`.
4. Fetch `GET https://discord.com/api/users/@me/guilds`.
5. Filter the guilds to the staff permission bits.
6. Create a server-side session.
7. Set a cookie and redirect to the allow-listed dashboard origin.

Recommended cookie properties:

```text
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

Because Cloudflare proxies the Render response, the Pages Function strips the
upstream cookie's `Domain` attribute before returning it to the browser.

### `GET /api/auth/me`

Return the current session and every server the staff member can manage:

```json
{
  "user": {
    "id": "123456789012345678",
    "username": "riya.mehta",
    "globalName": "Riya Mehta",
    "avatarUrl": "https://cdn.discordapp.com/avatars/..."
  },
  "guilds": [
    {
      "id": "987654321098765432",
      "name": "UPCore Esports",
      "iconUrl": "https://cdn.discordapp.com/icons/...",
      "permissions": "32",
      "isBotPresent": true
    }
  ]
}
```

Return `401` when there is no valid session. Return `403` for an authenticated
user with no eligible servers. The frontend shows a clear access screen for
both cases.

### `GET /api/auth/logout`

Clear the session cookie and redirect to the allow-listed dashboard origin.
The dashboard sends `returnTo` only for that origin.

## 3. Scope every existing dashboard route

The selected server is sent as `guildId` on every request:

```text
GET   /api/dashboard/summary?guildId=<guild-id>
GET   /api/dashboard/activity?guildId=<guild-id>&limit=8
GET   /api/tickets?guildId=<guild-id>
PATCH /api/tickets/:ticketId?guildId=<guild-id>
GET   /api/moderation/cases?guildId=<guild-id>&limit=50
POST  /api/moderation/cases?guildId=<guild-id>
GET   /api/guild/settings?guildId=<guild-id>
PATCH /api/guild/settings?guildId=<guild-id>
GET   /api/analytics/commands?guildId=<guild-id>
GET   /api/members/activity?guildId=<guild-id>
GET   /api/healthz?guildId=<guild-id>
```

For every route:

1. Read the session.
2. Verify the selected guild is in the session's eligible guild list.
3. Verify the bot is currently in that guild.
4. Verify the staff member has the required Discord permission for mutations.
5. Record the authenticated Discord user as the audit actor.

Never trust an actor name or guild ID supplied in a JSON request body.

## 4. Staff activity route

### `GET /api/staff-activity`

Supported query parameters:

```text
guildId=<required>
category=moderation|tickets|settings|bot
staffId=<Discord user ID>
from=YYYY-MM-DD
to=YYYY-MM-DD
limit=100
```

The `category` parameter is omitted for the "All activity" view. Sort newest
first and cap the server-side limit.

Return:

```json
[
  {
    "id": "audit_01H...",
    "category": "tickets",
    "action": "claim",
    "title": "Ticket claimed",
    "detail": "Ticket #1048 · Club Wars SESA registration question",
    "actor": {
      "id": "123456789012345678",
      "username": "riya.mehta"
    },
    "occurredAt": "2026-09-02T08:06:00.000Z",
    "guildId": "987654321098765432",
    "metadata": {
      "ticketId": "1048"
    }
  }
]
```

Write an audit event for at least these actions:

- Tickets: claim, close, lock, unlock, escalate, assignment changes, notes
- Moderation: warning, mute, kick, ban, unban, case creation, notes
- Settings: every guild setting update
- Bot: startup, shutdown, reconnect, backup, command failures, configuration sync

Audit rows should be append-only. Restrict access to staff and never expose
message content unless the existing moderation policy explicitly permits it.

## 5. Bot health response

Keep `GET /api/healthz` unauthenticated for uptime monitoring, but accept the
optional `guildId` to report guild-specific readiness. In addition to the
existing `status`, return:

```json
{
  "status": "ok",
  "botReady": true,
  "botUser": "UPCore Bot",
  "guildId": "987654321098765432",
  "uptimeSeconds": 123456,
  "database": "connected",
  "latencyMs": 42,
  "lastHeartbeatAt": "2026-09-02T08:06:00.000Z"
}
```

## 6. CORS and proxy notes

Dashboard requests are same-origin on Pages, so no browser CORS configuration
is needed for production. For direct local requests to the Render API, allow
the exact Replit preview origin and set:

```text
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Do not use `Access-Control-Allow-Origin: *` with session cookies.
