# Folio — Self-Hosted Docker Setup Guide

This guide explains how to run **Folio** entirely on your own hardware using Docker. No Supabase account required.

> **Prefer the cloud?** See [supabase_guide.md](supabase_guide.md) for the Supabase + Vercel path.

---

## What runs in Docker?

| Service | Image | Purpose |
|---|---|---|
| **Folio App** | Built locally | Next.js production server |
| **PostgreSQL 16** | `postgres:16-alpine` | Primary database |
| **SeaweedFS** | `chrislusf/seaweedfs` | S3-compatible image storage |

> **Why SeaweedFS instead of MinIO?**
> SeaweedFS uses the **Apache 2.0** licence — fully permissive. MinIO's server uses AGPLv3, which has stricter redistribution requirements. SeaweedFS provides a full S3-compatible API, so all standard S3 SDKs work with it out of the box.

---

## Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) (v24+) or Docker Engine + Compose plugin
- Git
- At least 2 GB free disk space

---

## Step 1 — Clone & Configure Environment

```bash
git clone https://github.com/IncuForge/folio
cd folio/v0.1

# Copy the Docker env template
cp .env.docker .env.local
```

Open `.env.local` and **change every secret value**:

```env
# ── Database ─────────────────────────────────────────────────────────
POSTGRES_PASSWORD=pick_a_strong_database_password

# ── Image Storage ─────────────────────────────────────────────────────
STORAGE_ACCESS_KEY=folio_access
STORAGE_SECRET_KEY=pick_a_strong_storage_secret

# Generate with: openssl rand -hex 32
SESSION_SECRET=replace_with_long_random_secret
```

> **Keep `.env.local` out of git.** It is already listed in `.gitignore`.

---

## Step 2 — Configure SeaweedFS Credentials

Open `docker/seaweedfs_s3.json` and make sure the `accessKey` / `secretKey` match your `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` from `.env.local`:

```json
{
  "identities": [
    {
      "name": "folio_access",
      "credentials": [
        {
          "accessKey": "folio_access",
          "secretKey": "YOUR_STORAGE_SECRET"
        }
      ],
      "actions": ["Read", "Write", "List", "Tagging", "Admin"]
    }
  ]
}
```

---

## Step 3 — Build & Start the Stack

```bash
docker compose --env-file .env.local up -d --build
```

Docker will:
1. Pull `postgres:16-alpine` and `chrislusf/seaweedfs`
2. Build the Next.js app image (takes ~2 minutes on first run)
3. Run `lib/schema.sql` automatically to initialize tables and seed data
4. Start all three services

Check that everything is running:

```bash
docker compose ps
```

All three services should show `Status: healthy` or `Up`.

---

## Step 4 — Create the Storage Bucket

SeaweedFS does not auto-create buckets. Run this once after the stack is up:

```bash
# Using the AWS CLI (easiest)
aws s3 mb s3://dish-images \
  --endpoint-url http://localhost:8333 \
  --region us-east-1
```

> **No AWS CLI?** The app will attempt to auto-create the bucket on first image upload. If that fails, install the AWS CLI and run the command above.

---

## Step 5 — Access the App

| URL | What it is |
|---|---|
| `http://localhost:3000` | Folio app |
| `http://localhost:9333` | SeaweedFS master admin UI |
| `http://localhost:8333` | SeaweedFS S3 API endpoint |
| `localhost:5432` | PostgreSQL (connect via TablePlus, DBeaver, etc.) |

Log in using the seeded admin credentials:

| Email | Password | Role |
|---|---|---|
| `admin1@cater.com` | `7QegW6PgVol7Sv` | Admin |
| `admin2@cater.com` | `uGQ9jb35ziL0xg` | Admin |

> **Change these immediately** via **Settings → User Accounts** after your first login.

---

## Step 6 — Expose to the Internet (Optional)

### Option A — Cloudflare Tunnel

Cloudflare Tunnel lets you publish your local service without opening firewall ports.

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared   # macOS
# or: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# One-time authentication
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create folio

# Route to your domain
cloudflared tunnel route dns folio your-subdomain.your-domain.com

# Run the tunnel
cloudflared tunnel run --url http://localhost:3000 folio
```

For a quick test without a custom domain:

```bash
cloudflared tunnel --url http://localhost:3000
```

### Option B — Tailscale

```bash
# Install Tailscale: https://tailscale.com/download
tailscale up

# Your app is then reachable at http://<tailscale-ip>:3000
# from any device on your Tailnet
```

> If you expose SeaweedFS publicly, update `STORAGE_PUBLIC_URL` in `.env.local` to your public domain (e.g., `https://storage.your-domain.com`) so uploaded images are served correctly.

---

## Maintenance

### View logs
```bash
docker compose logs -f app         # App logs
docker compose logs -f postgres    # Database logs
docker compose logs -f seaweedfs   # Storage logs
```

### Stop the stack
```bash
docker compose down
```

### Rebuild after a code change
```bash
docker compose up -d --build app
```

### Back up the database
```bash
docker exec folio_postgres \
  pg_dump -U folio folio \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore a backup
```bash
cat your_backup.sql | docker exec -i folio_postgres \
  psql -U folio folio
```

---

## Deploying to a Cloud VM (e.g., DigitalOcean, Hetzner)

You can run the exact same Docker setup on any cloud VPS:

1. SSH into your server
2. Clone the repo and set up `.env.local` as above
3. Run `docker compose up -d --build`
4. Point a domain at your server IP using Cloudflare (free proxy + SSL)
5. Set `STORAGE_PUBLIC_URL` to your public domain if exposing SeaweedFS

> For Vercel + Supabase instead, see [supabase_guide.md](supabase_guide.md).

---

## Migrating to Supabase Cloud

If you want to move from Docker to Supabase:

1. Export your data via the app: **Settings → Export → JSON**
2. Set up a Supabase project following [supabase_guide.md](supabase_guide.md)
3. Switch your `.env` to Supabase credentials (remove `DATABASE_URL`)
4. Import your data via the API or Supabase dashboard

---

## Licence

- **Folio** — Refer License of Project (IncuForge)
- **PostgreSQL** — PostgreSQL Licence
- **SeaweedFS** — Apache 2.0
- **Next.js** — MIT
