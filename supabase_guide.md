# Folio — Supabase Cloud Setup Guide

This guide walks you through connecting Folio to a **Supabase** cloud database for a fully serverless deployment (e.g., on Vercel). No servers to manage — Supabase handles the database.

> **Not using Supabase?** See [DOCKER_SETUP.md](DOCKER_SETUP.md) for the self-hosted Docker path.

---

## Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in.
2. Click **New Project** from your dashboard.
3. Fill in the project details:
   - **Name**: `Folio` (or anything you like)
   - **Database Password**: Generate a strong password and save it somewhere safe.
   - **Region**: Choose the region closest to your users.
   - **Pricing Plan**: The **Free Plan** is more than sufficient for thousands of catering orders.
4. Click **Create new project** and wait ~2 minutes for provisioning to finish.

---

## Step 2 — Initialize the Database Schema

Folio uses a custom schema — Supabase won't auto-create any tables. You need to run the schema script once.

1. In your Supabase project, click the **SQL Editor** icon in the left sidebar.
2. Click **New Query → New Blank Query**.
3. Open [`lib/schema.sql`](lib/schema.sql) from this repository.
4. Copy the entire file contents and paste them into the SQL editor.
5. Click **Run**.
6. Confirm you see: *"Success. No rows returned."*
7. Click **Table Editor** (grid icon in the sidebar) to verify the following tables exist:
   - `users`, `items`, `packages`, `package_items`, `orders`, `order_items`

---

## Step 3 — Schema Cache Reload (Important!)

After applying migrations or schema changes, PostgREST (the Supabase API layer) caches the schema. If you add new columns to the database (e.g., `discount_percent`), you must reload the cache:

1. Go to the **SQL Editor**.
2. Run:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
3. If you still see *"column not found in schema cache"* errors, wait 30 seconds and try again.

---

## Step 4 — Get Your API Keys

1. In your Supabase project, click **Settings → API** in the left sidebar.
2. Copy these two values:
   - **Project URL** — e.g., `https://xbiqqvfv.supabase.co`
   - **service_role key** — click **Reveal** next to the secret key labeled `service_role`

> **Important**: Use the `service_role` key (not the `anon` key). Folio uses the service role key server-side to bypass Supabase RLS and perform all database operations. The anon key is only needed for client-side Supabase Auth flows, which Folio does not use.

---

## Step 5 — Configure Environment Variables

### For local development

Create or update your `.env` file:

```env
# ── Supabase Cloud Mode ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# ── Session Secret ───────────────────────────────────────────────────
SESSION_SECRET=a_long_random_string_at_least_32_chars

# ── Do NOT set DATABASE_URL in Supabase mode ─────────────────────────
# If DATABASE_URL is set, the app switches to direct PostgreSQL mode
# and ignores Supabase credentials entirely.
```

### For Vercel (Cloud Deployment)

1. Push your repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Go to your project's **Settings → Environment Variables**.
4. Add the same variables listed above.
5. Deploy.

---

## Step 6 — Default Login Credentials

Folio uses its own authentication system (not Supabase Auth). Login credentials are seeded from `lib/schema.sql`:

| Email | Password | Role |
|---|---|---|
| `admin1@cater.com` | `7QegW6PgVol7Sv` | Admin |
| `admin2@cater.com` | `uGQ9jb35ziL0xg` | Admin |

> **Change these immediately** after your first login via the **Settings → User Accounts** panel.

---

## Step 7 — Verify It Works

1. Run locally: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Log in with the credentials above.
4. Confirm the dashboard loads and shows the seeded food items (e.g., *Paneer Tikka*, *Veg Biryani*).

---

## Authentication Notes

Folio does **not** use Supabase Auth. It uses its own custom session system:

- Credentials are validated against the `users` table in your database.
- On login, an **HTTP-only cookie** (`folio_session`) is set with the user's ID, email, and role.
- All database queries are made server-side using the `SUPABASE_SERVICE_ROLE_KEY` — this bypasses Supabase RLS entirely.
- Role-based access control (Admin vs. Manager) is enforced in the Next.js API routes and UI.

---

## Dish Images

By default, dishes use image URLs (paste any image link from Unsplash, etc.). No storage configuration is needed.

If you want to support file uploads to Supabase Storage in the future:
1. Go to **Storage** in the left sidebar.
2. Create a new bucket named `dish-images`.
3. Enable **Public Bucket**.
4. Update the storage integration in `lib/db.ts`.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `"column not found in schema cache"` | Run `NOTIFY pgrst, 'reload schema';` in the SQL Editor |
| Dashboard is empty after setup | Confirm you ran `schema.sql` fully and the `items` table has rows |
| Login fails with valid credentials | Check `SUPABASE_SERVICE_ROLE_KEY` is correct and not the anon key |
| `TypeError: Failed to fetch` | Check `NEXT_PUBLIC_SUPABASE_URL` is correct and the project is not paused |
