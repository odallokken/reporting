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

Tell the dashboard which domain name to use for the HTTPS certificate. Replace `reports.example.com` with your actual domain:

```bash
export DOMAIN=reports.example.com
```

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

## Connecting to Pexip Infinity

Once the dashboard is running, you need to connect it to your Pexip Infinity environment. There are two ways data flows into the dashboard:

### Option A — Live Events (Event Sink)

This gives you real-time participant activity as it happens.

1. Log in to your **Pexip Infinity Management Node**.
2. Go to **Platform → Global Settings → Event sink**.
3. Set the event sink URL to:

   ```
   https://reports.example.com/api/events
   ```

   (Replace `reports.example.com` with your actual domain.)

4. Save the settings.

The dashboard will now receive live events whenever a conference starts or ends, and whenever a participant joins or leaves.

### Option B — Import Historical Data (CDR Import)

This pulls in conference records that were created before the dashboard was installed.

1. Open the dashboard in your browser.
2. Go to **Settings** (the gear icon).
3. Enter your Pexip Management Node URL, admin username, and password.
4. Click **Import** to pull in the historical records.

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

This downloads the latest code and rebuilds the application.

---

## Testing Without a Domain

If you don't have a domain name yet, you can run the dashboard locally with a self-signed certificate:

```bash
DOMAIN=localhost docker compose up -d --build
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

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | The public domain for HTTPS certificates (used by Caddy) |
| `DATABASE_URL` | `file:./dev.db` | Path to the SQLite database file |
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

### Tech Stack

- **[Next.js 15](https://nextjs.org/)** — App Router, TypeScript, server & client components
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Recharts](https://recharts.org/)** — Interactive charts and visualisations
- **[Prisma ORM](https://www.prisma.io/)** — Type-safe database access with SQLite
- **[Caddy](https://caddyserver.com/)** — Reverse proxy with automatic HTTPS
