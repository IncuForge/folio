# Folio

**Folio** is a local-first catering operations application for family-owned caterers and small teams. It brings event bookings, menus, kitchen preparation, customer records, collections, receipts, and backups into one focused workspace.

Folio runs as a cross-platform desktop application, an Android companion, or a conventional Next.js web application.

## Current capabilities

| Area | What Folio provides |
|---|---|
| **Dashboard** | Upcoming bookings, payment warnings, overdue balances, and urgent collections |
| **Orders Book** | Event bookings with multiple sessions, guest counts, menus, discounts, charges, statuses, and cloning |
| **Customers** | Reusable customer and contact records |
| **Calendar** | Monthly booking schedule |
| **Food Library** | Dishes, availability, pricing, and reusable package kits |
| **Billing** | One-, two-, or three-stage payment schedules with smart settlement handling |
| **Documents** | Branded receipts, menu PDFs, and kitchen preparation sheets |
| **Reports** | Revenue, collections, receivables, and event statistics |
| **Currencies** | ISO 4217 currency support for most countries, with localized names and symbols |
| **Backup & Restore** | Complete portable backups, validation, safety backups, and automatic retention |
| **Team access** | Administrator and manager accounts with role-based permissions |
| **Device sync** | Pair Android devices with a Folio desktop hub over LAN, VPN, or Tailscale-style networks |
| **Updates** | Signed desktop update support through the configured GitHub update feed |

## Local-first desktop application

The Tauri 2 desktop application is the primary local-first experience.

- Available for Windows x64, Linux x64, macOS Apple Silicon, and macOS Intel.
- Uses a local SQLite database managed by the desktop runtime.
- Starts Folio's local service for authorized browser and mobile access on the network.
- Keeps credentials, business settings, orders, library data, and backups on the owner's computer.
- Supports complete backup transfer when moving Folio to another computer.
- Uses custom Folio window chrome while retaining minimize, maximize/restore, close, dragging, and resizing.

Desktop binaries are produced by the **Folio Desktop** GitHub Actions workflow. Artifact names follow:

```text
folio-[platform]-[arch]-[bundle]
```

The project intentionally keeps downloadable builds in GitHub Actions artifacts rather than GitHub Releases.

## Android companion

The Android build uses the same Tauri 2 frontend and mobile-responsive Folio interface.

- Android can create an independent local workspace or pair with a Folio desktop hub.
- Pairing uses the QR code and short-lived code shown under **Settings → Devices & Sync** on desktop.
- On the same Wi-Fi network, use the desktop's LAN address.
- For remote private access, connect both devices through a VPN such as Tailscale and pair using that address.
- If the hub is unavailable, local work remains available and synchronization resumes when the connection returns.
- The desktop LAN webserver and desktop updater are not started by the Android build.

The current Android workflow produces an ARM64 debug artifact named:

```text
folio-android-debug
```

## Authentication and roles

The first-run setup creates the business profile and owner account. Folio does not ship a universal administrator password.

| Role | Access |
|---|---|
| **Admin** | Full access, including users, backups, restore, device pairing, library editing, and deletion |
| **Manager** | Operational access based on the manager restrictions enforced by the application |

Passwords are stored as one-way hashes. Portable backups include credential hashes so a restored installation retains its accounts, but never contain plaintext passwords.

## Data and backups

A complete Folio backup contains the operational workspace: customers, food items, package kits, orders, past and future bookings, payment records, settings, users, and related links.

Before restoring, Folio validates the backup and creates a safety copy of the current workspace. Automatic desktop backups use configurable frequency and retention settings.

Use **Settings → Backup & Data** to download, validate, restore, or configure backups.

## International currencies

Folio stores an ISO 4217 currency code alongside its display symbol. This avoids ambiguity between currencies that share symbols such as `$`, `£`, `¥`, or `kr`.

Existing installations using legacy symbol-only settings are migrated automatically. Number grouping follows the device locale, and India-specific payment defaults such as UPI remain available when INR is selected.

## Development setup

### Requirements

- Node.js 22 recommended
- npm
- No local Rust toolchain is required when using GitHub Actions to build desktop and Android binaries

### Install and run the Next.js application

```bash
git clone https://github.com/IncuForge/folio.git
cd folio
npm install
```

Create `.env.local` from `.env.example` and provide a strong `SESSION_SECRET` plus either Supabase or PostgreSQL configuration.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the desktop renderer

```bash
npm run desktop:dev
```

A complete native Tauri development build additionally requires the Rust and platform prerequisites documented by Tauri. If those are intentionally not installed locally, push the branch and download the GitHub Actions artifact instead.

## Validation

```bash
npx tsc --noEmit
npm test
npm run build
npm run desktop:build
```

The test suite uses Node's built-in test runner and an isolated SQLite database. It does not require a running PostgreSQL or Supabase service.

## Optional web deployments

The Next.js version can still run independently of the desktop application.

### Supabase / hosted

Configure the Supabase variables in `.env.example`. See [supabase_guide.md](supabase_guide.md).

### PostgreSQL / Docker

Set `DATABASE_URL` or use the provided Docker stack. See [DOCKER_SETUP.md](DOCKER_SETUP.md).

The desktop application's embedded SQLite workflow does not require bundling PostgreSQL.

## GitHub Actions

| Workflow | Purpose |
|---|---|
| **Folio CI** | TypeScript, tests, Next.js production build, and desktop renderer build |
| **Folio Desktop** | Windows, Linux, macOS Apple Silicon, and macOS Intel bundles |
| **Folio Android** | ARM64 Android debug APK |

All workflows run on pushes to `main` and `codex/**`. They can also be started manually from the Actions tab.

## Project structure

| Path | Purpose |
|---|---|
| `app/` | Next.js application, API routes, global styling, and setup flow |
| `components/` | Dashboard, orders, customers, calendar, library, reports, settings, and document UI |
| `desktop/` | Tauri renderer integration, desktop database adapter, synchronization, and custom titlebar |
| `src-tauri/` | Rust application shell, permissions, bundling, Android generation, updater, and local server |
| `lib/` | Database adapters, authentication, backups, currency support, business logic, and shared state |
| `tests/` | API, database, sync, and currency compatibility tests |
| `.github/workflows/` | CI, desktop packaging, and Android artifact workflows |

## Documentation

| Guide | Coverage |
|---|---|
| [DOCS.md](DOCS.md) | Technical architecture, API routes, schema, and authentication |
| [ASSISTED_QUICKSTART.md](ASSISTED_QUICKSTART.md) | Assisted hosted setup |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | PostgreSQL/Docker deployment |
| [supabase_guide.md](supabase_guide.md) | Supabase deployment |
| [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) | Product direction and planned work |

## Built by

Folio is built and maintained by [IncuForge](https://incuforge.pages.dev/) · [GitHub](https://github.com/IncuForge/folio)
