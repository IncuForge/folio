# Folio — AI-Assisted Quickstart Guide

This guide walks you through setting up Folio from zero using an AI coding agent — no manual server configuration, no copy-pasting SQL blindly, no guessing at environment variables.

The AI handles the installation, helps you through the Supabase setup using the Supabase MCP tool, and verifies the connection.

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that lets AI assistants (like Claude) connect directly to external services — databases, APIs, cloud platforms — as tools they can call during your conversation.

With the **Supabase MCP** installed, your AI agent can:
- Create and inspect Supabase projects
- Run SQL migrations directly against your database
- Fetch API keys and project URLs
- Apply schema changes without you touching the dashboard

This means you can say _"set up my Folio database"_ and the agent does it — no copy-pasting SQL blocks.

---

## Prerequisites

Before you begin, install the following on your machine:

| Tool | Why | Install |
|---|---|---|
| **Node.js v18+** | Runs the app and MCP server | [nodejs.org](https://nodejs.org) |
| **Git** | Clone the repository | [git-scm.com](https://git-scm.com) |
| **An AI coding agent** | Drives the whole setup | See below |

### Recommended AI Agents

Any MCP-compatible agent works. Recommended options:

| Agent | Notes |
|---|---|
| **Claude Desktop** (Anthropic) | Best MCP support; free tier available |
| **Cursor** | Code editor with built-in Claude; MCP via settings |
| **Windsurf** (Codeium) | Built-in MCP support |
| **Google Gemini / Antigravity** | MCP support via config file |
| **VS Code + Copilot** | MCP available in recent builds |

> This guide uses Claude Desktop as the primary example, but the MCP config format is identical for all agents.

---

## Part 1 — Install the Supabase MCP

The Supabase MCP server is a local process that your AI agent talks to. It authenticates with Supabase using a personal access token and exposes tools like `create_project`, `apply_migration`, `execute_sql`, and `get_project_url`.

### Step 1.1 — Get a Supabase Personal Access Token

1. Go to [supabase.com](https://supabase.com) and sign in (create a free account if needed).
2. Click your avatar (top right) → **Access Tokens**.
3. Click **Generate New Token**.
4. Name it something like `folio-mcp` and click **Generate**.
5. **Copy the token immediately** — you won't see it again.

### Step 1.2 — Add the MCP to Your Agent

#### Claude Desktop

1. Open your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the following block (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "YOUR_SUPABASE_ACCESS_TOKEN"
      ]
    }
  }
}
```

3. Replace `YOUR_SUPABASE_ACCESS_TOKEN` with the token from Step 1.1.
4. **Restart Claude Desktop**.

#### Cursor

1. Open **Cursor Settings** → **MCP**.
2. Click **Add MCP Server**.
3. Enter:
   - **Name**: `supabase`
   - **Command**: `npx`
   - **Args**: `-y @supabase/mcp-server-supabase@latest --access-token YOUR_SUPABASE_ACCESS_TOKEN`
4. Save and restart Cursor.

#### Windsurf

1. Open **Windsurf Settings** → **AI Features** → **MCP Servers**.
2. Add a new entry using the same `npx` command above.

#### VS Code + GitHub Copilot

1. Open `.vscode/mcp.json` in your workspace (create if needed):

```json
{
  "servers": {
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "YOUR_SUPABASE_ACCESS_TOKEN"
      ]
    }
  }
}
```

#### Google Gemini / Antigravity

Add to your `~/.gemini/config/mcp_servers.json`:

```json
{
  "supabase": {
    "command": "npx",
    "args": [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      "--access-token",
      "YOUR_SUPABASE_ACCESS_TOKEN"
    ]
  }
}
```

### Step 1.3 — Verify the MCP is Connected

After restarting your agent, open a new conversation and type:

```
List my Supabase organizations
```

If the MCP is working, the agent will call the Supabase MCP tool and return your organization list (even if it's just one). If it fails, double-check your token and that the config file path is correct.

---

## Part 2 — Clone the Project

Open a terminal and run:

```bash
git clone https://github.com/IncuForge/folio
cd folio/v0.1
npm install
```

Then open the project folder in your agent's IDE or point your agent to it.

---

## Part 3 — AI-Assisted Supabase Setup

Now open your AI agent and paste the following prompt to kick off the automated setup:

---

> **Prompt to paste into your AI agent:**
>
> I want to set up Folio on Supabase. Here's what I need you to do:
>
> 1. Create a new Supabase project called "Folio" in my organization. Pick the closest region to Southeast Asia (or ask me which region to use).
> 2. Wait for the project to be ready.
> 3. Apply the database schema from the file `lib/schema.sql` in this project — read the file and run it against the new Supabase project using the MCP.
> 4. Reload the Supabase schema cache so PostgREST picks up the new tables.
> 5. Fetch the Project URL and the service_role key from the project API settings.
> 6. Create a `.env` file in the root of this project using the `.env.example` template, filling in the Supabase credentials you just retrieved.
> 7. Tell me what the default login credentials are and remind me to change them after logging in.

---

The agent will:
- Call `create_project` via MCP → spin up a fresh Supabase Postgres instance
- Read `lib/schema.sql` from your local project
- Call `apply_migration` or `execute_sql` via MCP → run the full schema and seeds
- Call `NOTIFY pgrst, 'reload schema'` → refresh the PostgREST schema cache
- Call `get_project_url` and `get_publishable_keys` → retrieve your credentials
- Write your `.env` file with everything filled in

> **If the agent gets stuck:** You can break this into smaller steps. Try: *"Create the Supabase project first"*, then *"Now apply the schema from lib/schema.sql"*, then *"Get my project URL and service_role key"*.

---

## Part 4 — Run the App

Once your `.env` is set up:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Log in with the default credentials:

| Email | Password | Role |
|---|---|---|
| `admin1@cater.com` | `7QegW6PgVol7Sv` | Admin |
| `admin2@cater.com` | `uGQ9jb35ziL0xg` | Admin |

> **Change these immediately** — go to **Settings → User Accounts** and update the passwords.

---

## Part 5 — Verify Everything Works

Ask your agent to verify the setup:

```
Verify that the Folio Supabase project is healthy:
- Check the database has these tables: users, items, packages, package_items, orders, order_items
- Run a quick SELECT COUNT(*) on the items table to confirm seed data is present
- Confirm the project URL and service_role key in my .env match the project
```

The agent will use the MCP to query the live database and confirm everything is in order.

---

## Part 6 — Deploy to Vercel (Optional)

If you want to deploy to the cloud:

```
Help me deploy Folio to Vercel:
- The project is at github.com/IncuForge/folio
- Use the Supabase project we just set up
- The environment variables needed are in my .env file
- Walk me through the Vercel import and environment variable setup
```

The agent will guide you through:
1. Pushing to GitHub (if not already)
2. Importing the project on Vercel
3. Setting the environment variables
4. Triggering a deploy

---

## Troubleshooting with AI

If something breaks, describe the error to your agent and include:
- The full error message
- Which step you were on
- The name of your Supabase project

Useful follow-up prompts:

| Problem | What to ask |
|---|---|
| *"column not found in schema cache"* | `"Run NOTIFY pgrst, 'reload schema' on my Folio Supabase project"` |
| Tables not created | `"Re-apply lib/schema.sql to my Folio Supabase project"` |
| Login fails | `"Check that the users table in my Folio project has the seeded accounts"` |
| `.env` file missing values | `"Fetch the project URL and service_role key for my Folio Supabase project and update my .env"` |

---

## What the MCP Can Do (Reference)

When the Supabase MCP is connected, your agent has access to these tools:

| Tool | What it does |
|---|---|
| `list_organizations` | List your Supabase orgs |
| `create_project` | Spin up a new Supabase project |
| `get_project` | Get project details and status |
| `list_tables` | List all tables in the DB |
| `apply_migration` | Run a SQL migration |
| `execute_sql` | Run an arbitrary SQL query |
| `get_project_url` | Get the project's REST API URL |
| `get_publishable_keys` | Get API keys (anon + service_role) |
| `get_logs` | Fetch recent logs |
| `pause_project` | Pause a project (free tier management) |

> **Security note:** The MCP uses your personal access token and has full access to your Supabase account. Do not paste your token into chat history or commit it to git. Keep it in the MCP config file only.

---

## Further Reading

| Guide | What it covers |
|---|---|
| [README.md](README.md) | Product overview and quick start |
| [DOCS.md](DOCS.md) | Full technical reference |
| [supabase_guide.md](supabase_guide.md) | Manual Supabase setup (without AI) |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Self-hosted Docker setup |
| [Supabase MCP Docs](https://supabase.com/docs/guides/ai-tools/mcp) | Official MCP reference |
