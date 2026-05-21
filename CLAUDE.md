# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Prompt Library — CLAUDE.md

## Project Overview
Personal prompt management system (Botable NZ, Apache 2.0, open-source). Save, search (hybrid semantic + FTS), and adapt prompts using an LLM. Built with Next.js 15 App Router + TypeScript + Supabase + pgvector.

Live at `https://prompt-library-ten-iota.vercel.app`. Started as a personal tool — keep scope conservative, this is not a product build.

## Stack
- **Framework**: Next.js 15, App Router, TypeScript strict mode (webpack — Turbopack is disabled, it spawned thousands of workers)
- **Database**: Supabase (Postgres + pgvector)
- **Auth**: Supabase Auth, email OTP, invite-only (`shouldCreateUser: false`). Roles `admin` / `guest` stored in `app_metadata.role` (JWT-embedded, set via service role). RLS-first — DB policies are primary enforcement, API guards are defense-in-depth.
- **Embeddings**: OpenRouter `text-embedding-3-small` (384-dim) via `openai` SDK — same API key as LLM
- **LLM**: OpenRouter via `openai` SDK with baseURL override (`OPENROUTER_API_KEY` + `OPENROUTER_MODEL` in env)
- **Styling**: Tailwind CSS, dark theme (zinc-950)

## Key Architecture Decisions
- Embeddings are generated **synchronously** on `POST /api/prompts` and `PATCH /api/prompts/[id]` (when any searchable field changes)
- Embedding text includes title, summary, category, tags, use_cases, body, notes — all labeled (e.g. `Title: ...`) for better retrieval
- Default search is **always free** — no LLM on the search path. Hybrid = vector cosine (80%) + FTS weighted boolean match (20%)
- Prompts carry retrieval-metadata fields: `topic`, `series`, `search_aliases` — included in embedding text and FTS weighting
- **FTS fallback**: if embedding generation fails, search gracefully falls back to FTS-only rather than erroring
- **Auto-fill merge rule**: `mergeAutoFill()` in `lib/auto-fill-merge.ts` — user input always wins; LLM only fills blank fields. Never overwrite what the user typed.
- LLM is called in `/api/adapt` (adaptation), `/api/auto-fill` (title/description/topic/series/search_aliases from body), and optionally in search reranking (`?rerank=1` — reorders top-20 candidates by relevance)
- `prompt_versions` stores full JSONB snapshots of the prompt row on every edit
- `prompt_variants` stores `frozen_body` (parent body at creation time) + `adapted_body` (immutable output)
- Variable placeholders use `{{variable_name}}` syntax only — no nesting

## Conventions (don't reintroduce past pain)
- **API routes**: wrap the entire POST/PATCH/DELETE body in top-level try/catch and always return `NextResponse.json(...)`. An unhandled throw (e.g. from `req.json()` or `requireAdmin()`) makes Next.js return plain text, which breaks `res.json()` on the client.
- **Browser Supabase client**: use `createBrowserClient` from `@supabase/ssr`, not `@supabase/supabase-js`. The plain client stores session in localStorage; the server can't read that, so `getUser()` returns null.
- **No HTTP self-fetch in App Router**: server components must call search/db functions directly, not their own API routes.
- **No local ML models**: ONNX runtime is ~250MB and blows Vercel's 250MB serverless limit. Embedding lives in OpenRouter.
- **Embedding model parity**: index-time and query-time models must match. Both are `text-embedding-3-small` (384-dim).
- **tsx scripts**: wrap async code in `async function main() {...}; main().catch(...)` (top-level await breaks in CJS). Use `node --env-file=.env.local node_modules/tsx/dist/cli.mjs script.ts` in npm scripts, not `./node_modules/.bin/tsx`.

## Folder Structure
```
app/                    Next.js App Router pages + API routes
  api/
    prompts/            list/create + [id] get/patch/delete + [id]/variants
    search/             hybrid search endpoint (optional ?rerank=1); /facets for filter chip counts
    adapt/              LLM adaptation
    auto-fill/          LLM title/description/topic/series/search_aliases from body
    export/             portable JSON export
lib/
  auth/                 requireAdmin/requireUser server helpers
  supabase/             Browser (@supabase/ssr) + server clients
  embeddings/           Embedding pipeline (OpenRouter)
  search/               vector.ts, fts.ts, scoring.ts, rerank.ts, facets.ts
  adaptation/           variables.ts (extract/detect), llm.ts (OpenRouter)
  auto-fill-merge.ts    Merge strategy: user input wins, LLM fills blanks only
  types.ts              All shared TypeScript types
components/             React components (prompt-card, prompt-form, search-bar, adapt-flow)
supabase/migrations/    SQL migrations (run via Supabase dashboard or CLI)
scripts/                seed.ts, embed.ts, reindex.ts, set-admin.ts, backfill-owner.ts,
                        backfill-retrieval-metadata.ts, report-duplicates.ts, search-benchmark.ts
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (default: `anthropic/claude-haiku-4-5`)

## Database Setup
Create a new Supabase project, then run migrations in order via the SQL Editor or `supabase db push`:
- `001_enable_pgvector.sql`
- `002_initial_schema.sql`
- `003_search_function.sql`
- `004_rls_ownership.sql`
- `005_retrieval_metadata.sql` — adds `topic`, `series`, `search_aliases` columns
- `006_fts_rpc.sql` — weighted FTS RPC function
- `007_fts_weights.sql` — FTS weighting enhancements

After migration 004, configure your admin account:
1. Supabase Dashboard → Authentication → Users → Invite user
2. `npm run set-admin -- <your-user-id>`
3. Re-login to mint a fresh JWT with the admin role
4. `npm run backfill-owner -- <your-user-id>` (only needed if you have pre-existing prompts)

Supabase OTP email template note: the default sends a magic link, not a code. Add `{{ .Token }}` to the Magic Link template body so the 8-digit code appears.

## Scripts
```bash
npm run dev              # Next dev on port 3001 (webpack)
npm run lint             # ESLint via next lint
npm run seed             # Insert example prompts
npm run embed            # Generate embeddings for prompts missing them
npm run reindex          # Re-embed ALL prompts (after model/schema changes)
npm run set-admin        # Grant admin role to a user (service role)
npm run backfill-owner   # Backfill owner_id on legacy prompts
npm run backfill-retrieval-metadata  # Populate topic/series/search_aliases on existing prompts
npm run report-duplicates            # Print duplicate-detection report
npm run search-benchmark             # Run retrieval quality benchmark
```

## Deployment
Vercel is connected to `botablenz-prog/Prompt-Library`, branch `main`. Both `origin` and `vercel` remotes point to the same repo — pushing either deploys.

```bash
git push origin main
```

## Variable System
Prompts can contain `{{variable_name}}` placeholders. Variables are defined in:
- `required_variables`: `[{ name, type, required: true, description?, options? }]`
- `optional_variables`: `[{ name, type, required: false, description?, default? }]`

Types: `text` (short), `long_text` (textarea), `choice` (dropdown from `options[]`)

## Code Style
- Keep it simple — no over-engineering
- Only add features explicitly requested
- No unnecessary comments or docstrings
- TypeScript strict mode throughout
- Tailwind for all styling — no CSS modules or styled-components
