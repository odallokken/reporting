# Pexip Infinity Reporting Dashboard

A full-stack analytics and reporting dashboard for **Pexip Infinity** video conferencing environments. Track VMR usage, conference history, participant activity, and identify stale rooms.

## Tech Stack

- **[Next.js 15](https://nextjs.org/)** — App Router, TypeScript, server & client components
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Recharts](https://recharts.org/)** — Interactive charts and visualisations
- **[Prisma ORM](https://www.prisma.io/)** — Type-safe database access with SQLite

## Features

- 📊 **Dashboard** — Overview charts: conference activity over 30 days, top 5 active VMRs, recent participant events
- 🏠 **VMR Management** — Sortable, searchable table of all Virtual Meeting Rooms with stale detection
- 🔍 **VMR Detail** — Per-room stats, conference frequency chart, expandable conference/participant history
- ⚡ **Real-time Feed** — Auto-refreshing participant join/leave activity (5-second polling)
- ⚙️ **Settings** — Copy event sink URL, import historical CDRs from Pexip Management API
- 📥 **CDR Import** — Pull conference history directly from the Pexip Management Node REST API
- 📤 **CSV Export** — Download full VMR list with stats as CSV
- 🔔 **Event Sink Webhook** — Receive live events from Pexip Infinity (`POST /api/events`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npx prisma migrate dev --name init

# 3. Seed with sample data (optional)
npx prisma db seed

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pexip Integration

### Event Sink (live events)

In the Pexip Infinity Management Node go to **Platform → Global Settings → Event sink** and set the URL to:

```
https://<your-hostname>/api/events
```

The dashboard receives `conference_started`, `conference_ended`, `participant_connected`, and `participant_disconnected` events.

### CDR Import (historical data)

Go to **Settings** in the dashboard and enter your Management Node URL, admin username, and password to import historical conference records via the Pexip History API.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/events` | Pexip event sink webhook |
| `GET` | `/api/dashboard` | Dashboard summary stats |
| `GET` | `/api/vmrs` | List VMRs (search, sort, paginate) |
| `GET` | `/api/vmrs/[id]` | VMR detail with conferences |
| `GET` | `/api/vmrs/export` | Export VMRs as CSV or JSON |
| `GET` | `/api/conferences` | List conferences (filter by VMR/date) |
| `GET` | `/api/realtime` | Recent participant events |
| `POST` | `/api/cdrs/import` | Import CDRs from Pexip Management API |

## Production Deployment (Docker + ACME)

The project includes a Docker Compose setup that runs the Next.js app behind a **[Caddy](https://caddyserver.com/)** reverse proxy. Caddy automatically obtains and renews TLS certificates from **Let's Encrypt** via the ACME protocol — no manual certificate management required.

### Quick start

```bash
# 1. Set your public domain
export DOMAIN=reports.example.com

# 2. Build and start
docker compose up -d --build
```

Caddy will:
- Listen on ports **80** and **443**
- Automatically obtain a Let's Encrypt certificate for your domain
- Redirect HTTP → HTTPS
- Reverse-proxy HTTPS traffic to the Next.js app
- Auto-renew the certificate before it expires (every ~60 days)

### Requirements

- A public DNS record pointing `DOMAIN` to the server's IP address
- Ports **80** and **443** open (required for ACME HTTP-01 challenge)
- Docker and Docker Compose installed

### Local / staging testing

For local development without a real domain, Caddy will use a self-signed certificate:

```bash
DOMAIN=localhost docker compose up -d --build
```

To use the **Let's Encrypt staging** environment (avoids rate limits during testing), add a global option to the `Caddyfile`:

```caddyfile
{
    acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}
```

### Architecture

```
Internet → :443 (Caddy + TLS) → :3000 (Next.js app, internal)
```

Caddy stores certificates in a Docker volume (`caddy-data`). The SQLite database is stored in a separate volume (`app-data`).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | App base URL (used by server components) |
| `DOMAIN` | `localhost` | Public domain for TLS certificate (used by Caddy) |
