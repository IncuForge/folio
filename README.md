# Folio

**Folio** is a catering management app built for family-owned and small-team catering businesses. It replaces messy spreadsheets and paper order books with a clean, modern digital system that works on any device.

---

## What does it do?

| Feature | Description |
|---|---|
| **Orders** | Create and manage event bookings with guest counts, sessions, and menu selections |
| **Food Library** | Maintain your full dish catalog and build reusable package templates |
| **Dashboard** | See upcoming events, overdue payments, and urgent collections at a glance |
| **Calendar** | Monthly view of all scheduled events |
| **Payments** | Track 3-milestone payment schedules (deposit, midway, settlement) per booking |
| **Reports** | Revenue summaries and event statistics |
| **Print / PDF** | Generate printable bill receipts and kitchen sheets per order |
| **Settings** | Manage team user accounts and currency/payment preferences |

---

## Who can use it?

There are two user roles:

- **Admin** — Full access. Can manage everything including users, the food catalog, and all orders.
- **Manager** — Limited access. Can create and view orders and manage payments, but cannot delete orders or modify the food catalog.

Default login credentials are seeded on first setup. See the setup guides below.

---

## Deployment Options

Folio supports two deployment paths:

### ☁️ Option A — Cloud (Supabase + Vercel)
- Easiest to get started. No servers to manage.
- See **[supabase_guide.md](supabase_guide.md)** for the full walkthrough.

### 🐳 Option B — Self-Hosted (Docker)
- Run everything on your own machine or home server.
- See **[DOCKER_SETUP.md](DOCKER_SETUP.md)** for the full walkthrough.

---

## Quick Start (Local Development)

1. Install [Node.js](https://nodejs.org) (v18 or newer)
2. Clone this repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up your `.env` file (copy from `.env.example` and fill in your Supabase or local DB credentials)
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser

---

## Documentation

| Guide | What it covers |
|---|---|
| [ASSISTED_QUICKSTART.md](ASSISTED_QUICKSTART.md) | 🤖 Set up everything using an AI agent + Supabase MCP |
| [DOCS.md](DOCS.md) | Full technical reference — architecture, API routes, DB schema, auth |
| [supabase_guide.md](supabase_guide.md) | Step-by-step cloud setup with Supabase + Vercel |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Step-by-step self-hosted setup with Docker |

---

## Built by

Folio is built and maintained by [IncuForge](https://incuforge.pages.dev/) · [GitHub](https://github.com/IncuForge/folio)
