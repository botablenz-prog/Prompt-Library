# Prompt Library

A self-hosted prompt management system with hybrid semantic search and LLM-powered adaptation. Save, find, and reuse your best prompts.

---

## What this is / what this is not

**This is** a practical, self-hosted tool for individuals and small teams who work with LLMs daily. It helps you build a personal library of prompts, find them by meaning (not just keywords), and adapt them to new tasks with minimal friction.

**This is not** a multi-tenant SaaS platform, an enterprise prompt governance system, or a vector database framework. It is intentionally lean — built for daily use, not for scale-out complexity.

---

## Features

- **Hybrid search** — vector cosine similarity (80%) + full-text search (20%), no LLM on the search path
- **LLM adaptation** — fill in variables, answer follow-up questions, get a ready-to-use prompt
- **Variable system** — define `{{variable_name}}` placeholders with types (`text`, `long_text`, `choice`)
- **Variants** — save adapted outputs as immutable variants linked to the original
- **Version history** — every edit creates a full JSONB snapshot
- **Role-based access** — admin/viewer roles via Supabase Auth (email OTP)
- **Optional reranking** — LLM reranking of search results via `?rerank=1`

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict |
| Database | Supabase (Postgres + pgvector) |
| Embeddings | OpenRouter `text-embedding-3-small` (384-dim) |
| LLM | OpenRouter (configurable model via env var) |
| Styling | Tailwind CSS |

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/botablenz-prog/prompt-library.git
cd prompt-library
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your values (see [Environment variables](#environment-variables) below).

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migrations in order (see [Database setup](#database-setup))

### 4. Set up your admin account

1. Go to Supabase Dashboard → Authentication → Users → **Invite user** with your email
2. Run: `npm run set-admin -- <your-user-id>`
3. Run: `npm run backfill-owner -- <your-user-id>`

### 5. Seed and run

```bash
npm run seed    # optional: insert example prompts
npm run dev     # starts on http://localhost:3001
```

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `OPENROUTER_API_KEY` | OpenRouter API key — used for embeddings and LLM |
| `OPENROUTER_MODEL` | Any OpenRouter model ID (default: `anthropic/claude-haiku-4-5`) |

Get your OpenRouter key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

---

## Database setup

Run these migrations in order via the Supabase SQL Editor or `supabase db push`:

| Migration | Purpose |
|---|---|
| `supabase/migrations/001_enable_pgvector.sql` | Enable pgvector extension |
| `supabase/migrations/002_initial_schema.sql` | Core tables (prompts, variants, versions) |
| `supabase/migrations/003_search_function.sql` | Hybrid search RPC function |
| `supabase/migrations/004_rls_ownership.sql` | Row-level security + auth roles |

---

## Scripts

```bash
npm run seed      # Insert example prompts
npm run embed     # Generate embeddings for prompts missing them
npm run reindex   # Re-embed ALL prompts (run after model or schema changes)
npm run set-admin -- <user-id>        # Grant admin role to a user
npm run backfill-owner -- <user-id>   # Assign ownership of existing prompts
```

---

## Architecture

- **Search is always free** — no LLM calls on the search path. Hybrid = vector cosine (80%) + FTS boolean match (20%), merged and scored in `lib/search/scoring.ts`
- **Embeddings on write** — generated synchronously on `POST /api/prompts` and `PATCH /api/prompts/[id]` when any searchable field changes
- **Embedding text** includes title, summary, category, tags, use_cases, body, notes — all labeled for better retrieval
- **LLM is called** only in `/api/adapt` (adaptation) and optionally for search reranking (`?rerank=1`)
- **Variable placeholders** use `{{variable_name}}` syntax — types: `text`, `long_text`, `choice`
- **Variants** store `frozen_body` (parent body at creation) + `adapted_body` (immutable output)
- **Versions** store full JSONB snapshots of the prompt row on every edit

See [CLAUDE.md](CLAUDE.md) for full architecture notes and code style guidelines.

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
