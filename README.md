# Prompt Library

A self-hosted prompt management system. Save, search, and adapt your best LLM prompts — with hybrid semantic search and one-click adaptation.

**Built by [Botable NZ](https://github.com/botablenz-prog)** · Apache 2.0

---

## What this is / what this is not

**This is** a practical, self-hosted tool for individuals and small teams who work with LLMs daily. It helps you build a personal library of prompts, find them by meaning (not just keywords), and adapt them to new tasks with minimal friction.

**This is not** a multi-tenant SaaS platform, an enterprise prompt governance system, or a vector database framework. It is intentionally lean — built for daily personal use, not for scale-out complexity.

---

## Features

- **Hybrid search** — finds prompts by meaning, not just keywords. No LLM cost on the search path.
- **LLM adaptation** — fill in variables, answer smart follow-up questions, get a ready-to-use prompt
- **Variable system** — define `{{variable_name}}` placeholders with types (`text`, `long_text`, `choice`)
- **Variants** — save adapted outputs as immutable variants linked to the original prompt
- **Version history** — every edit creates a full snapshot so you can always go back
- **Role-based access** — admin/viewer roles via Supabase Auth (email OTP — no password required)
- **Optional LLM reranking** — reorder search results by relevance via `?rerank=1`

---

## Prerequisites

Before you start, you need:

| Requirement | Version | Where to get it |
|---|---|---|
| **Node.js** | v18.17 or higher | [nodejs.org/en/download](https://nodejs.org/en/download) |
| **Git** | Any recent version | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **Supabase account** | Free tier is fine | [supabase.com](https://supabase.com) |
| **OpenRouter account** | Free to sign up | [openrouter.ai](https://openrouter.ai) |

> **Cost note:** OpenRouter charges per token. For personal use (searching, adapting a few prompts per day), expect to spend less than $1/month. Add $5 credit to start — it will last a long time.

---

## Installation

### Option A — Windows (recommended for non-developers)

1. **Download or clone this repository**
   - Click the green **Code** button on GitHub → **Download ZIP** → unzip it anywhere you like
   - Or if you have Git: `git clone https://github.com/botablenz-prog/prompt-library.git`

2. **Run the setup script**
   - Open the folder in File Explorer
   - Double-click `setup.bat`
   - This will check your Node.js version, install dependencies, and create your `.env.local` file

3. **Fill in your environment variables** — skip to [Configuration](#configuration)

### Option B — Mac / Linux

```bash
git clone https://github.com/botablenz-prog/prompt-library.git
cd prompt-library
chmod +x setup.sh
./setup.sh
```

### Option C — Manual setup

```bash
git clone https://github.com/botablenz-prog/prompt-library.git
cd prompt-library
npm install
cp .env.local.example .env.local
```

---

## Configuration

Open the `.env.local` file in a text editor and fill in these values:

### 1. Supabase credentials

1. Go to [supabase.com](https://supabase.com) → create a new project (free tier is fine)
2. Once created, go to: **Project Settings → API**
3. Copy these values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=        ← "Project URL" on that page
NEXT_PUBLIC_SUPABASE_ANON_KEY=   ← "anon public" key
SUPABASE_SERVICE_ROLE_KEY=       ← "service_role secret" key (keep this private!)
```

### 2. OpenRouter credentials

1. Go to [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Create a new API key
3. Copy it into `.env.local`:

```
OPENROUTER_API_KEY=     ← your OpenRouter API key
OPENROUTER_MODEL=anthropic/claude-haiku-4-5   ← leave as-is, or change to any model
```

> **Spend protection (recommended):** Set a monthly credit limit on your OpenRouter API key at openrouter.ai/settings/keys → **Credit limits**. This caps your spend if the app is left running or your session is ever compromised. All LLM routes require admin authentication, so external users cannot trigger API calls — but a credit cap is good practice regardless.

---

## Database setup

You need to run 4 SQL migration files in your Supabase project. This takes about 5 minutes.

1. Go to your Supabase project → click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open each file below in a text editor, copy its contents, paste into the SQL Editor, and click **Run**:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/001_enable_pgvector.sql` | Enables vector search |
| 2 | `supabase/migrations/002_initial_schema.sql` | Creates tables |
| 3 | `supabase/migrations/003_search_function.sql` | Creates search function |
| 4 | `supabase/migrations/004_rls_ownership.sql` | Sets up access control |

Run them **in order**. Each one must succeed before running the next.

---

## First-time admin setup

After running migrations, you need to create your admin account:

### Step 1 — Create your user account

1. Start the app: `npm run dev` — open [http://localhost:3001](http://localhost:3001)
2. Click **Sign in** and enter your email address
3. Check your email for a 6-digit code — enter it to log in
   > This app uses **email OTP** (a one-time code) instead of a password. This is by design — it's simpler and more secure.

### Step 2 — Grant yourself admin access

1. Go to your Supabase project → **Authentication** → **Users**
2. Find your user in the list and **copy your User ID** (looks like: `abc12345-...`)
3. In your terminal (inside the project folder), run:

```bash
npm run set-admin -- YOUR-USER-ID-HERE
npm run backfill-owner -- YOUR-USER-ID-HERE
```

4. **Sign out and sign back in** — this refreshes your session with the admin role

### Step 3 — (Optional) Add sample prompts

```bash
npm run seed
```

---

## Running the app

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Uninstalling

This app runs entirely on your machine (plus your Supabase and OpenRouter accounts). To remove it:

1. **Delete the project folder** — removes all local files
2. **Delete your Supabase project** — goes to Project Settings → General → Delete project
3. **Revoke your OpenRouter API key** — goes to openrouter.ai/settings/keys → delete the key

There is no installer, no system-level changes, no registry entries.

---

## Scripts reference

```bash
npm run dev       # Start development server (http://localhost:3001)
npm run build     # Build for production
npm run start     # Start production server

npm run seed      # Insert example prompts into the database
npm run embed     # Generate embeddings for prompts that are missing them
npm run reindex   # Re-embed ALL prompts (run after model changes)

npm run set-admin -- <user-id>       # Grant admin role to a user
npm run backfill-owner -- <user-id>  # Assign ownership of existing prompts to a user
```

---

## Architecture

- **Search is always free** — no LLM calls on the search path. Hybrid = vector cosine (80%) + full-text search (20%), merged in `lib/search/scoring.ts`
- **Embeddings on write** — generated when you create or edit a prompt (only when searchable fields change)
- **LLM is called only** in `/api/adapt` (prompt adaptation) and optionally for reranking (`?rerank=1`)
- **Variable placeholders** use `{{variable_name}}` syntax — types: `text`, `long_text`, `choice`
- **Variants** store a snapshot of the parent prompt body + the adapted output (immutable)
- **Versions** store full snapshots of every edit so you can see prompt history

See [CLAUDE.md](CLAUDE.md) for full architecture notes and code style guidelines.

---

## Security notes

- **Service role key** — the `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` has full database access. Never share it, never commit it to git.
- **Variants are public by design** — in this MVP, all prompts and variants are readable by anyone who can access your app. If you add `context_used` data during adaptation (e.g. personal details), be aware that it is stored in the variant record. This is intentional for a personal self-hosted tool; see migration 004 for how to restrict access if needed.
- **Rate limiting** — there is no built-in rate limiting on LLM endpoints (`/api/adapt`, `/api/auto-fill`). If you deploy this publicly (not just for personal use), enable rate limiting at your hosting provider level (e.g. Vercel's built-in rate limiting or Cloudflare).
- **Email OTP** — login uses a 6-digit one-time code sent to your email. No passwords are stored.

---

## Troubleshooting

**"Cannot find module" errors after cloning**
→ Run `npm install` to install dependencies.

**Search returns no results**
→ After seeding, run `npm run embed` to generate embeddings. Without embeddings, vector search returns nothing.

**Search returns no results after seeding**
→ The seed script uses a local HuggingFace model to generate embeddings, which is incompatible with the OpenRouter model used by the live app. After running `npm run seed`, always run `npm run reindex` to re-embed all prompts with the correct model.

**"Unauthorized" when trying to create prompts**
→ You haven't been granted admin access yet. Complete the [First-time admin setup](#first-time-admin-setup) steps.

**Login code never arrives**
→ Check spam. If still nothing, go to Supabase → Authentication → Email templates and verify your email settings.

**App won't start — "port 3001 in use"**
→ Another process is using port 3001. Either stop that process, or change the port in `package.json`: `"dev": "next dev --port 3002"`.

---

## Contributing

PRs are welcome. Please keep the following in mind:

- TypeScript strict mode — no `any`, no implicit types
- Tailwind only — no CSS modules or styled-components
- Keep it simple — don't add features or abstractions beyond what's needed
- No unnecessary comments or docstrings

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

Copyright 2026 Botable NZ
