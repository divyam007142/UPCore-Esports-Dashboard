# UPCore Esports Dashboard

A premium, responsive operations dashboard for UPCore Esports staff. It gives your team one place to monitor bot health, tickets, moderation cases, guild automation, and command activity.

The dashboard is now a standalone Vite + React application. It no longer depends on the original Replit monorepo, generated workspace packages, or the bot's internal files.

## Features

- Command center with live-style guild health, member presence, ticket volume, moderation backlog, and recent activity
- Searchable ticket desk with status and assignee updates
- Moderation casebook with a create-case workflow
- Guild settings for automod, welcome messages, translation assist, and log channel
- Command usage analytics with success rates and trends
- Responsive mobile navigation
- Demo mode that works on a static host without a backend
- Portable REST API integration through `VITE_API_BASE_URL`

## Quick start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Create a production build:

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env` when connecting a real API:

```bash
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://your-api.example.com/api
```

If `VITE_DEMO_MODE` is omitted or set to anything other than `false`, the dashboard runs in demo mode. Demo edits are persisted in the browser's local storage so the interface remains usable on static hosting.

For production data, set `VITE_DEMO_MODE=false` and point `VITE_API_BASE_URL` at your separately deployed REST API. The browser never talks directly to Discord, MongoDB, or the bot repository.

## REST API contract

The frontend expects these endpoints under the configured API base URL:

```text
GET    /healthz
GET    /dashboard/summary
GET    /dashboard/activity
GET    /tickets
PATCH  /tickets/:ticketId
GET    /moderation/cases
POST   /moderation/cases
GET    /guild/settings
PATCH  /guild/settings
GET    /analytics/commands
GET    /members/activity
```

The API layer should authenticate staff, authorize actions per guild, and translate Discord/MongoDB data into these response shapes. Keep that adapter on the server side.

## Project structure

```text
src/
  App.tsx                  # Dashboard routes and UI
  api.ts                   # Portable API client, types, and demo data
  index.css                # UPCore visual system
  main.tsx                 # React entry point
  components/
    error-boundary.tsx
  pages/
    not-found.tsx
public/
  favicon.svg
  robots.txt
docs/
  DEPLOYMENT.md            # Hosting guide
  upcore-dashboard.png    # Dashboard preview
```

## Connecting the UPCore bot safely

Use this architecture:

```text
Discord <-> UPCore Bot <-> Bot adapter / REST API <-> Dashboard
```

Do not import bot source files into the browser and do not expose MongoDB credentials to the frontend. The bot adapter should:

1. Read the bot's existing MongoDB models and Discord client state on the server.
2. Map that data to the dashboard API contract.
3. Validate and authorize every write action.
4. Send Discord actions through the bot's own services.
5. Return safe, UI-focused JSON to the dashboard.

Member statistics should be collected server-side as counts and session durations only:

- Current total and online members come from the Discord guild cache.
- Message counts are incremented for human messages without storing message content.
- Voice time is recorded when a member leaves or changes voice channels.
- The `/members/activity` response powers the Member stats page.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for static hosting, API hosting, SPA fallback, environment variables, and provider examples.

## License

MIT