# Pexip Infinity Reporting Dashboard

A web-based reporting dashboard for **Pexip Infinity** video conferencing. It gives you charts, tables, and exports covering VMR usage, conference history, and participant activity — all in one place.

---

## What Does This Dashboard Do?

- 📊 **Dashboard** — Charts showing conference activity over the last 30 days, your top 5 busiest VMRs, and recent participant events.
- 🏠 **VMR Management** — A searchable, sortable list of all your Virtual Meeting Rooms, with detection of rooms that are no longer in use.
- 🔍 **VMR Detail** — Click into any room to see its stats, conference history, and individual participant records.
- ⚡ **Live Activity Feed** — A real-time view of participants joining and leaving conferences (updates every 5 seconds).
- 📥 **CDR Import** — Pull in historical conference records from your Pexip Management Node.
- 📤 **CSV Export** — Download your full VMR list as a spreadsheet-ready CSV file.

---

## How It Works

The dashboard runs as a small web application on a server you control. It has two parts:

1. **The app** — A Next.js web application that provides the dashboard UI and stores data in a local SQLite database.
2. **Caddy** — A lightweight reverse proxy that sits in front of the app, handles HTTPS, and automatically obtains a free TLS certificate from Let's Encrypt.

Both parts run inside Docker containers, so installation is straightforward.

```
Internet → Caddy (HTTPS on port 443) → Dashboard app (port 3000, internal only)
```

---

## Installation Guide

Follow the steps below in order. By the end you will have the dashboard running on your server with a valid HTTPS certificate.

### Step 1 — What You Will Need

Before you start, make sure you have:

- ✅ An **Ubuntu server** (22.04 or newer) with a public IP address.
- ✅ A **domain name** (e.g. `reports.example.com`) with a DNS A-record pointing to your server's IP address.
- ✅ **Ports 80 and 443** open in your firewall / cloud security group. These are needed for HTTPS certificate generation.
- ✅ **SSH access** to the server so you can run commands on it.

> **Don't have a domain yet?** You can still test locally — see the [Testing Without a Domain](#testing-without-a-domain) section further down.

### Step 2 — Install Docker

Docker lets you run the dashboard without having to install Node.js, databases, or other software directly on the server. Run the following commands on your Ubuntu server:

```bash
# Update the package list
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Download Docker's signing key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the Docker package repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Now allow your user account to run Docker commands without `sudo`:

```bash
sudo usermod -aG docker $USER
```

**Log out and log back in** for this change to take effect. You can verify Docker is working by running:

```bash
docker --version
```

> **Not using Ubuntu?** See the [official Docker install guide](https://docs.docker.com/engine/install/) for other operating systems.

### Step 3 — Install Git

Git is used to download the dashboard source code. It may already be installed on your server. Check by running:

```bash
git --version
```

If it is not installed, run:

```bash
sudo apt-get install -y git
```

### Step 4 — Download the Dashboard

Clone (download) the project files to your server:

```bash
git clone https://github.com/odallokken/reporting.git
cd reporting
```

You should now be inside a folder called `reporting` that contains all the project files.

### Step 5 — Set Your Domain Name

Create your `.env` file by copying the example template:

```bash
cp .env.example .env
```

Then open it and set your domain name:

```bash
nano .env
```

Change the `DOMAIN` line to your domain:

```
DOMAIN=reports.example.com
```

Save and close the file (`Ctrl+X`, then `Y`, then `Enter` in nano).

### Step 6 — Build and Start the Dashboard

This single command builds the application and starts everything:

```bash
docker compose up -d --build
```

The first time you run this it will take a few minutes as Docker downloads and builds all the components.

Once it finishes, the dashboard will:

- Be available at **https://your-domain.com**
- Automatically obtain a free HTTPS certificate from Let's Encrypt
- Redirect any HTTP traffic to HTTPS
- Restart automatically if the server reboots

### Step 7 — Verify It Is Running

Open your browser and go to `https://reports.example.com` (using your actual domain). You should see the dashboard homepage.

You can also check the status of the running containers:

```bash
docker compose ps
```

Both the `app` and `caddy` services should show a status of `Up`.

---

## Troubleshooting

If you cannot access the dashboard after starting it, work through the following checks.

### 1. Check That the Containers Are Running

```bash
docker compose ps
```

Both `app` and `caddy` should show `Up`. If either is restarting or exited, check the logs:

```bash
docker compose logs app
docker compose logs caddy
```

### 2. Verify Your Domain Is Set

Make sure the `.env` file contains the correct domain:

```bash
cat .env
```

You should see `DOMAIN=your-domain.com` (not `localhost`). After changing the `.env` file, rebuild:

```bash
docker compose up -d --build
```

### 3. Confirm DNS Points to Your Server

Your domain must have a DNS A-record pointing to your server's public IP. You can check this with:

```bash
dig +short your-domain.com
```

The result should be your server's IP address.

### 4. Check That Ports 80 and 443 Are Open

Caddy needs ports 80 and 443 to obtain a TLS certificate from Let's Encrypt. Make sure these ports are open in your firewall and cloud security group. You can test from another machine:

```bash
curl -v http://your-domain.com
```

If the connection times out, the ports are likely blocked.

### 5. Check the Caddy Logs for Certificate Errors

```bash
docker compose logs caddy
```

Look for errors related to TLS or ACME. Common causes:
- DNS not pointing to the server
- Ports 80/443 blocked by a firewall
- Let's Encrypt rate limits (wait an hour and try again)

### 6. Git Pull Fails With "Your local changes to .env would be overwritten"

If you see this error when running `git pull`:

```
error: Your local changes to the following files would be overwritten by merge:
        .env
Please commit your changes or stash them before you merge.
```

This happens because `.env` used to be tracked by git but has since been removed. Your local copy still has the old tracked version with your changes. To fix it, stash your changes, pull, and then restore:

```bash
git stash
git pull origin main
git stash pop
```

After this, your `.env` file will be untracked and ignored by git, so this error will not happen again on future pulls.

---

## Connecting to Pexip Infinity

Once the dashboard is running, you need to connect it to your Pexip Infinity environment. There are two ways data flows into the dashboard:

### Option A — Live Events (Event Sink)

This gives you real-time participant activity as it happens.

1. Log in to your **Pexip Infinity Management Node**.
2. Go to **System → Event sinks** and add a new event sink (or edit an existing one).
3. Set the **URL** to:

   ```
   https://reports.example.com/api/events
   ```

   (Replace `reports.example.com` with your actual domain.)

4. In the **Location** field, select the system location(s) that contain your **transcoding Conferencing Nodes**.

   > **Important:** Event sinks must be assigned to locations that perform transcoding. Locations that only contain Proxying Edge Nodes do not generate events — the events for proxied calls are sent from the transcoding location instead.

5. Save the event sink.

The dashboard will now receive live events whenever a conference starts or ends, and whenever a participant joins or leaves.

### Option B — Import Historical Data (CDR Import)

This pulls in conference records that were created before the dashboard was installed.

1. Open the dashboard in your browser.
2. Go to **Settings** (the gear icon).
3. Enter your Pexip Management Node URL, administrator username, and password.
    - Use the Management Node base URL only, for example `https://pexip.example.com`
    - Do **not** include `/admin` or any other path in the URL
4. Click **Save credentials** so the values are remembered in your browser.
5. Click **Import** to pull in the historical records.

You can use both options together — the CDR import for historical data, and the event sink for ongoing live activity.

---

## Managing the Dashboard

Here are some common tasks you may need after installation.

### Viewing Logs

To see what the dashboard is doing (useful for troubleshooting):

```bash
cd reporting
docker compose logs -f
```

Press `Ctrl+C` to stop watching the logs.

### Stopping the Dashboard

```bash
cd reporting
docker compose down
```

### Restarting the Dashboard

```bash
cd reporting
docker compose restart
```

### Updating to a New Version

```bash
cd reporting
git pull
docker compose up -d --build
```

This downloads the latest code and rebuilds the application. Your `.env` file is not tracked by git, so it will be preserved automatically.

> **Note:** If you are updating from an older version where `.env` was still tracked by git, the pull may fail with an error about local changes being overwritten. See [Troubleshooting item 6](#6-git-pull-fails-with-your-local-changes-to-env-would-be-overwritten) for the fix.

---

## Testing Without a Domain

If you don't have a domain name yet, you can run the dashboard locally with a self-signed certificate. The default `DOMAIN=localhost` in the `.env` file already supports this, so just run:

```bash
docker compose up -d --build
```

Open `https://localhost` in your browser. You will see a browser warning about the certificate — this is normal for self-signed certificates. Click through the warning to access the dashboard.

---

## Local Development

If you want to work on the dashboard code itself (not just run it), you can start a development environment without Docker.

### Prerequisites

- **[Git](https://git-scm.com/downloads)**
- **[Node.js 18+](https://nodejs.org/)** (includes `npm`)

### Steps

```bash
# Clone the repository
git clone https://github.com/odallokken/reporting.git
cd reporting

# Install dependencies
npm install

# Set up the database
npx prisma migrate dev --name init

# Load sample data (optional)
npx prisma db seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Reference

### Environment Variables

All variables are configured in the `.env` file at the root of the project.

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | The public domain for HTTPS certificates (used by Caddy). Set this to your domain before deploying. |
| `DATABASE_URL` | `file:./dev.db` | Path to the SQLite database file |
| `AUTH_SECRET` | Auto-generated | Secret used to encrypt session tokens. Auto-generated and persisted on first start if not set. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base URL of the app (used by server components) |

### API Endpoints

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

### Pexip Infinity API Communications

This section documents every API interaction between the reporting portal and the Pexip Infinity environment.

#### Authentication

All outbound requests to the Pexip Management Node use **HTTP Basic Authentication** with the following headers:

- `Authorization: Basic <base64(username:password)>`
- `Accept: application/json`
- `Content-Type: application/json`
- `Cache-Control: no-cache, no-store, must-revalidate`

HTTP 3xx redirects are followed automatically with the same credentials.

#### Outbound Requests (Portal → Pexip)

All outbound calls are **GET** requests. The portal does not perform any POST, PUT, DELETE, or PATCH operations against the Pexip Management Node — it is a read-only consumer.

| # | Method | Pexip API Endpoint | Triggered By | Purpose |
|---|--------|--------------------|--------------|---------|
| 1 | `GET` | `/api/admin/configuration/v1/conference/` | Static VMRs page | Fetches all static VMR configurations (name, description, aliases, pin, guest_pin, allow_guests, tag, service_type). Supports `?name__icontains=` for search. Follows pagination via `meta.next`. |
| 2 | `GET` | `/api/admin/configuration/v1/conference/?limit=0` | Static VMRs page (count mode) | Fetches only `meta.total_count` to get the total number of static VMRs without returning objects. |
| 3 | `GET` | `/api/admin/configuration/v1/conference/` | Dynamic VMRs page | Fetches all static VMR names to build an exclusion list, so dynamic VMRs can be identified by filtering out known static ones. Follows pagination. |
| 4 | `GET` | `/api/admin/configuration/v1/scheduled_conference/` | Scheduled VMRs page | Fetches all scheduled conference VMRs (id, name, description, creation_time, duration, start_time, end_time, is_active, service_type, tag). Follows pagination. |
| 5 | `GET` | `/api/admin/configuration/v1/scheduled_alias/` | Scheduled VMRs page | Fetches all scheduled aliases (id, alias, scheduled_conference, description). Called in parallel with #4. Follows pagination. |
| 6 | `GET` | `/api/admin/history/v1/conference/` | CDR Import (Settings page) | Fetches all historical conference records (id, name, start_time, end_time, call_id, participant URIs). Follows pagination via `meta.next`. |
| 7 | `GET` | `/api/admin/history/v1/participant/?conference=<id>` | CDR Import (Settings page) | For each conference from #6, fetches its participant records (display_name, call_uuid, connect_time, disconnect_time). Follows pagination. |

**Pagination:** All Pexip Management API responses are paginated. The portal follows the `meta.next` field until it is `null`, enforcing the original `baseOrigin` on each subsequent URL to prevent issues with reverse proxies.

#### Inbound Webhook (Pexip → Portal)

Pexip Infinity pushes real-time events to the portal via the **Event Sink** mechanism. This is configured in the Pexip Management Node under **System → Event sinks** (see [Connecting to Pexip Infinity](#connecting-to-pexip-infinity)).

| Method | Portal Endpoint | Pexip Event Types |
|--------|-----------------|-------------------|
| `POST` | `/api/events` | `conference_started` — A new conference has begun. |
| `POST` | `/api/events` | `conference_ended` — A conference has ended. |
| `POST` | `/api/events` | `participant_connected` — A participant joined a conference. Includes protocol, role, aliases, bandwidth, vendor, encryption, and media node details. |
| `POST` | `/api/events` | `participant_updated` — A participant's state changed (bandwidth, mute, role, encryption, media node). |
| `POST` | `/api/events` | `participant_disconnected` — A participant left a conference. Includes disconnect reason, duration, and end-of-call media stream statistics. |
| `POST` | `/api/events` | `participant_media_stream_window` — Periodic quality report for an active participant. Includes call quality ratings (audio, video, presentation) and packet loss history. |
| `POST` | `/api/events` | `participant_media_streams_destroyed` — Final media stream statistics when streams are torn down. |
| `POST` | `/api/events` | `eventsink_bulk` — A batch envelope containing multiple events of any of the above types. |

#### Source Files

| File | Role |
|------|------|
| `src/lib/pexip.ts` | Core HTTP client — `fetchWithBasicAuth()`, `fetchAllPexipPages()`, `fetchStaticVmrNames()` |
| `src/app/api/vmrs/static/route.ts` | Outbound calls #1 and #2 (static VMRs) |
| `src/app/api/vmrs/route.ts` | Outbound call #3 (static VMR name exclusion for dynamic VMRs) |
| `src/app/api/vmrs/scheduled/route.ts` | Outbound calls #4 and #5 (scheduled VMRs and aliases) |
| `src/app/api/cdrs/import/route.ts` | Outbound calls #6 and #7 (CDR conference and participant import) |
| `src/app/api/events/route.ts` | Inbound event sink webhook receiver |

### Tech Stack

- **[Next.js 15](https://nextjs.org/)** — App Router, TypeScript, server & client components
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Recharts](https://recharts.org/)** — Interactive charts and visualisations
- **[Prisma ORM](https://www.prisma.io/)** — Type-safe database access with SQLite
- **[Caddy](https://caddyserver.com/)** — Reverse proxy with automatic HTTPS
- **[@react-pdf/renderer](https://react-pdf.org/)** — Server-side PDF generation for the Executive Report

---

## Executive Report (PDF Export)

The dashboard includes a built-in **Executive Report** feature that generates a downloadable, glossy PDF summary suitable for C-level audiences.

### Accessing the feature

Click **Executive Report** in the top navigation bar (or the sidebar). You will be taken to `/reports`.

### Selecting a time period

Choose from quick presets (Last 7 days, Last 30 days, Last 90 days, Last quarter, Last year, Month-to-date, Year-to-date) or enter a custom start/end date. The date range is validated before the PDF is generated.

### What the PDF contains

1. **Cover page** — Report title, selected period, and generation timestamp.
2. **Executive summary** — An auto-generated narrative paragraph highlighting the key findings.
3. **High-level KPIs** — Total unique VMRs, total meetings, total participant sessions, and total meeting hours.
4. **Peak concurrent participants chart** — Area/line chart over the selected period with the peak value annotated.
5. **Top 10 most used VMRs** — Sorted table showing VMR name, number of calls, total call duration, and participant count.
6. **Top 10 most active participants** — Sorted table showing participant name/alias, number of meetings joined, and total time in calls.
7. **Call quality overview** — Quality distribution (Good / OK / Bad / Terrible), average packet loss, and average jitter across all media streams for the period.

### Downloading

Click **Generate & Download PDF**. The browser will download a file named `executive-report-YYYYMMDD-YYYYMMDD.pdf`.

### Technical details

| Item | Detail |
|------|--------|
| API route | `GET /api/reports/pdf?start=YYYY-MM-DD&end=YYYY-MM-DD` |
| Runtime | Node.js (`export const runtime = 'nodejs'`) |
| PDF library | `@react-pdf/renderer` v4 |
| Data module | `src/lib/reports/data.ts` — shared data-access helpers |
| PDF template | `src/lib/reports/pdf-document.tsx` — React-PDF document component |
| UI page | `src/app/reports/page.tsx` |

No additional environment variables are required. The feature uses the same Prisma database as the rest of the dashboard.
