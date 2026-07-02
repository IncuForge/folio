# Folio — Technical Documentation

This document covers the full technical internals of Folio for developers maintaining, extending, or deploying the application.

---

## Architecture Overview

Folio is a **Next.js 16 App Router** application with:

- **Frontend**: React (client components), Vanilla CSS design system
- **Backend**: Next.js API routes (server-side, `/api/*`)
- **Database**: Dual-mode adapter — Supabase cloud SDK *or* direct PostgreSQL via `pg` pool
- **Auth**: Custom HTTP-only cookie session (no NextAuth, no Supabase Auth)

---

## Dual Database Mode

The database adapter at [`lib/db.ts`](lib/db.ts) auto-detects the environment at startup and switches between two drivers:

### Mode A — Supabase (Cloud)
Activated when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set and `DATABASE_URL` is empty.
- Uses the Supabase JS SDK
- All queries run via the Service Role Key (bypasses RLS)
- Ideal for serverless deployment on Vercel

### Mode B — PostgreSQL (Self-Hosted)
Activated when `DATABASE_URL` is set. This takes priority over Supabase credentials.
- Uses a `pg.Pool` for direct SQL queries
- Designed for Docker with local PostgreSQL 16
- Optional SeaweedFS (Apache 2.0) for S3-compatible image storage

### SQLite Mode (Tests Only)
The test runner (`tests/`) injects a SQLite in-memory database via Node's built-in `sqlite` module. The adapter auto-switches when `NODE_TEST_CONTEXT` is set.

---

## Database Schema

Schema source: [`lib/schema.sql`](lib/schema.sql)

| Table | Purpose |
|---|---|
| `users` | User accounts with email, hashed password, and role (`admin`/`manager`) |
| `items` | Food Library — individual dishes with name, type, price, availability |
| `packages` | Package templates — bundled menu presets |
| `package_items` | Many-to-many join between `packages` and `items` |
| `orders` | Client bookings with sessions (JSONB), milestone payments, status, and discount |
| `order_items` | Line items for legacy flat-order structure |

### Key fields on `orders`
```sql
sessions        JSONB      -- Array of session objects with package, items, guest count, date/time
additional_charges JSONB   -- Array of {label, amount} charge line items
discount_percent NUMERIC   -- Order-level discount percentage
booking_paid    BOOLEAN    -- 1st milestone payment status
second_paid     BOOLEAN    -- 2nd milestone payment status
final_paid      BOOLEAN    -- Final settlement payment status
```

---

## API Routes

All routes are under `app/api/`. Authentication is enforced server-side via the `folio_session` cookie.

| Route | Method | Description |
|---|---|---|
| `/api/auth/login` | `POST` | Validates credentials, sets session cookie |
| `/api/auth/logout` | `POST` | Clears session cookie |
| `/api/auth/check` | `GET` | Returns current user session |
| `/api/orders` | `GET`, `POST` | List all orders / create new order |
| `/api/orders/[id]` | `GET`, `PUT`, `DELETE` | Get, update, or delete a single order |
| `/api/orders/[id]/clone` | `POST` | Clone an order (resets payment state) |
| `/api/items` | `GET`, `POST` | List / create food library items |
| `/api/items/[id]` | `PUT`, `DELETE` | Update / soft-delete an item |
| `/api/items/[id]/availability` | `PATCH` | Toggle item availability |
| `/api/packages` | `GET`, `POST` | List / create package templates |
| `/api/packages/[id]` | `PUT`, `DELETE` | Update / soft-delete a package |
| `/api/users` | `GET`, `POST` | List / create user accounts (Admin only) |
| `/api/users/[id]` | `PUT`, `DELETE` | Update / delete a user account |
| `/api/settings` | `GET`, `POST` | Read / write app settings (currency, payment methods) |
| `/api/export/csv` | `GET` | Export all orders as CSV |
| `/api/export/json` | `GET` | Export all orders as JSON |
| `/api/export/backup` | `GET` | Full database backup download (Admin only) |
| `/api/log` | `POST` | Client-side error logging endpoint |

---

## Authentication & Sessions

Folio uses **custom application-level authentication**, not Supabase Auth or NextAuth.

- On login, the server validates the email/password against the `users` table
- A session cookie `folio_session` is set as **HTTP-Only** and **Secure** (in production)
- The cookie payload is base64-encoded JSON: `{ id, email, role, ts }`
- The `SESSION_SECRET` env variable is used to validate and sign session tokens
- **Passwords are stored in plaintext** — this is by design for internal/private network use. Do not expose without a reverse proxy + Cloudflare Tunnel or equivalent

### Roles
| Role | Permissions |
|---|---|
| `admin` | Full access: manage users, food catalog, orders, export backup |
| `manager` | Create/view orders, record payments. Cannot delete orders, edit food catalog, or download backups |

---

## Frontend Architecture

| Directory | Contents |
|---|---|
| `app/` | Next.js App Router pages and API routes |
| `app/ClientAppLayout.tsx` | Root client layout: auth state, sidebar, routing, theme |
| `components/` | Page-level view components |
| `lib/AppContext.tsx` | Global app state via React Context (orders, packages, items, settings) |
| `lib/date-utils.ts` | Date parsing, payment status calculation, cost helpers |
| `lib/db.ts` | Dual-mode database adapter |
| `lib/schema.sql` | PostgreSQL schema and seed data |
| `types/schema.ts` | TypeScript type definitions |

### View Components
| Component | View |
|---|---|
| `DashboardView.tsx` | Main dashboard with stats and payment warnings |
| `OrdersBookView.tsx` | Orders list with filters and status badges |
| `OrderFormView.tsx` | Create/edit order form with sessions and payment milestones |
| `FoodLibraryView.tsx` | Food item and package kit management |
| `CalendarView.tsx` | Monthly calendar with event markers |
| `ReportsView.tsx` | Revenue and event statistics charts |
| `SettingsView.tsx` | Currency, payment methods, user management |
| `ModalOverlays.tsx` | Order detail view, billing preview, PDF print layout |
| `Sidebar.tsx` | Desktop sidebar + mobile top bar and hamburger drawer |

---

## Design System

Folio uses a **warm paper / ink aesthetic** — no Tailwind, pure CSS custom properties.

Key CSS variables (defined in `app/globals.css`):
```css
--bg-app         /* Page background */
--bg-card        /* Card/surface background */
--ink            /* Primary text */
--ink-muted      /* Secondary text */
--border-ink     /* Hairline separators */
--border-strong  /* Strong borders */
```

Dark mode is toggled by adding the `.dark` class to the `<html>` element. All variables are overridden inside `.dark { ... }`.

---

## Environment Variables

```env
# ── Supabase Cloud Mode ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Self-Hosted Docker Mode ──────────────────────────
DATABASE_URL=postgresql://folio:password@postgres:5432/folio
STORAGE_ACCESS_KEY=folio_access
STORAGE_SECRET_KEY=your_storage_secret
STORAGE_ENDPOINT=http://seaweedfs:8333
STORAGE_PUBLIC_URL=http://localhost:8333

# ── Shared ───────────────────────────────────────────
SESSION_SECRET=a_long_random_secret_key
```

> If `DATABASE_URL` is set, it takes priority over Supabase credentials.

---

## Running Tests

```bash
npm run test
```

Tests use Node's built-in `node:test` runner with a SQLite in-memory database. No external services required.

---

## Production Build

```bash
npm run build
npm run start
```

The app is configured with `output: "standalone"` for Docker multi-stage builds.

---

## next.config.ts — allowedDevOrigins

The `allowedDevOrigins` setting is only active during `npm run dev` (development HMR). It is ignored in production builds.

**For local development on your own machine only:**
```ts
allowedDevOrigins: ["localhost:3000"]
```

**For LAN/Tailscale access during development:**
```ts
allowedDevOrigins: ["192.168.x.x", "100.x.x.x", "localhost:3000"]
```

**For cloud production deployment (Vercel, Docker, etc.):**
Remove or leave empty — `allowedDevOrigins` has no effect in production builds:
```ts
// Remove the allowedDevOrigins line entirely, or leave as empty array:
allowedDevOrigins: []
```

---

## Licence

- **Folio** — proprietary / private (IncuForge)
- **Next.js** — MIT
- **PostgreSQL** — PostgreSQL Licence
- **SeaweedFS** — Apache 2.0
- **Supabase JS** — MIT
