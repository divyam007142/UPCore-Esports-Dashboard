# UPCore Dashboard Deployment Guide

This guide deploys the dashboard as a standalone frontend on almost any static hosting provider. The dashboard can run in demo mode by itself or connect to a separately hosted REST API that sits between the UI and the UPCore Discord bot.

## 1. Prepare the project

Requirements:

- Node.js 18 or newer
- A Git repository containing this project
- An API URL only if you want live Discord data

Install and verify locally:

```bash
npm install
npm run typecheck
npm run build
```

The production files are written to `dist/`.

## 2. Choose a data mode

### Demo mode

Use this for a design preview or a static showcase:

```env
VITE_DEMO_MODE=true
```

No API is required. Ticket, settings, and moderation edits are stored locally in the browser.

### Live API mode

Use this when a server-side bot adapter is available:

```env
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://api.your-domain.com/api
```

The API must support CORS for your dashboard domain. Never put a Discord token, MongoDB connection string, or privileged bot credential in a `VITE_*` variable. Vite embeds `VITE_*` values into browser JavaScript.

## 3. Generic static hosting steps

These steps work for most providers:

1. Import the Git repository.
2. Set the framework to Vite, or choose a static site.
3. Set the install command to `npm install`.
4. Set the build command to `npm run build`.
5. Set the publish/output directory to `dist`.
6. Add `VITE_DEMO_MODE` and, for live mode, `VITE_API_BASE_URL`.
7. Enable SPA fallback so `/tickets`, `/moderation`, `/analytics`, and `/settings` serve `index.html`.
8. Deploy.

## Provider examples

### Vercel

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Add the environment variables in Project Settings.
- Add a rewrite from every route to `/index.html` if direct route refreshes return 404.

Example `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Add the environment variables in Site configuration.

Create `public/_redirects`:

```text
/* /index.html 200
```

### Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Add environment variables under Settings → Environment variables.
- Cloudflare Pages normally handles SPA fallback for an `index.html` build, but add a Pages Function or route rule if direct paths are not resolving.

### GitHub Pages

GitHub Pages is static, so use demo mode or a public HTTPS API:

```env
VITE_DEMO_MODE=true
```

If serving from `https://username.github.io/repository-name/`, set the Vite base path in `vite.config.ts` to `/repository-name/` before building, or use a custom domain. Add a Pages SPA fallback strategy if you need direct links to nested routes.

### Render Static Site

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Add a rewrite from `/*` to `/index.html`.
- Add environment variables in the Render dashboard.

### Railway, Fly.io, or a VPS

For a static-only deployment, build in CI and serve `dist/` with Nginx, Caddy, or a small static server. For a Node-based preview server:

```bash
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Use the provider's assigned `PORT` when required:

```bash
npm run preview -- --host 0.0.0.0 --port "$PORT"
```

## 4. Deploy the API separately

The dashboard is intentionally not coupled to the Discord bot. A production setup should deploy:

```text
dashboard.example.com  -> static Vite dashboard
api.example.com        -> authenticated REST API
Discord bot             -> existing bot process
MongoDB                 -> existing bot database
```

The REST API should:

- Verify a staff session or signed access token
- Check the staff member can act on the requested guild
- Rate-limit mutating endpoints
- Keep Discord and MongoDB credentials server-only
- Validate request bodies and return the documented JSON shapes
- Add `Access-Control-Allow-Origin` for the exact dashboard domain

The member stats page also expects:

```text
GET /members/activity
```

That route should return aggregate message counts and voice-session durations. Store counts and durations only; do not store message content.

Set the dashboard environment variable to the API's public URL:

```env
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://api.example.com/api
```

## 5. Troubleshooting

### A route works from navigation but refresh returns 404

Enable SPA fallback to `index.html`. This is required because the dashboard uses client-side routing.

### The dashboard shows demo data in production

Set `VITE_DEMO_MODE=false`, rebuild, and confirm that `VITE_API_BASE_URL` points to the API including the `/api` suffix.

### The API request is blocked by CORS

Configure the API server to allow the exact dashboard origin. Do not use `*` for authenticated production actions.

### Environment changes do not appear

Vite injects variables at build time. Trigger a new production build after changing them.

### The API is HTTPS but the dashboard is HTTP

Modern browsers block mixed content. Serve both through HTTPS.