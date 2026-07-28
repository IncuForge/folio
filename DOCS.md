# Folio — Technical Documentation

This document covers the full technical internals of Folio for developers maintaining, extending, or deploying the application.

---

## Architecture Overview

Folio has three maintained application surfaces:

- **Web**: Next.js 16 App Router, React client components, API routes, and the Folio Ledger CSS system.
- **Desktop**: Tauri 2 shell with a local SQLite database, updater, backups, and optional LAN synchronization hub.
- **Android**: Native Flutter client with its own offline SQLite workspace and optional pairing to Folio Desktop.

The hosted web backend can use Supabase or direct PostgreSQL. Web authentication uses a signed HTTP-only cookie session. Desktop owns its local data and Android stores pairing credentials in OS-backed encrypted storage.

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

### SQLite Mode (Desktop and Tests)
Folio Desktop uses the SQLite adapter in `desktop/src/desktop-api.ts` and the Tauri runtime so the installed application does not require PostgreSQL. The Node test runner injects an isolated SQLite database when `NODE_TEST_CONTEXT` is set. Flutter Android owns a separate SQLite cache/workspace and exchanges versioned snapshots through the desktop synchronization server.

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
- Passwords are stored as one-way hashes. New installations create the first owner through the first-run setup flow and do not ship universal credentials.
- Session cookies are signed and expire after seven days. Set a strong SESSION_SECRET for every production deployment.

## Portable backups

Settings → Database Backups exports a versioned Folio backup document containing all orders (past, active, and future), order-item links, library items, package kits, application settings, and user credential hashes. Passwords are never exported in plaintext.

Restore validates the document before enabling replacement and downloads a fresh safety backup first. Direct PostgreSQL restores are performed inside one transaction. Automatic backups are retained under data/backups; Docker mounts that directory onto the host.

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
| `desktop/` | Tauri renderer bridge, custom titlebar, desktop adapter, and synchronization coordination |
| `src-tauri/` | Rust desktop shell, SQLite commands, updater, local server, and synchronization hub |
| `mobile/folio_mobile/` | Native Flutter Android client with layered UI, repository, and service architecture |

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

Folio uses the **Folio Ledger** interface system: restrained operational surfaces, Switzer typography, semantic status colors, and pure CSS custom properties on web/desktop. Flutter mirrors the same tokens with Material components and native Android navigation.

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
npm run android:analyze
npm run android:test
```

The web/desktop tests use Node's built-in `node:test` runner with an isolated SQLite database. Flutter analysis and tests run from `mobile/folio_mobile/`. No external database service is required.

---

## Production Builds

```bash
npm run build
npm run desktop:build
npm run android:build
```

The Next.js app is configured with `output: "standalone"` for Docker multi-stage builds. Native desktop packages are created by the Tauri workflow. `npm run android:build` creates optimized Flutter APKs split by Android architecture.

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
- **Tauri** — Apache-2.0 or MIT
- **Flutter** — BSD-3-Clause
- **SQLite** — public domain
- **Switzer** — ITF Free Font License
- **PostgreSQL** — PostgreSQL Licence
- **SeaweedFS** — Apache 2.0
- **Supabase JS** — MIT
