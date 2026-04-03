# Prompt Library — CLAUDE.md

## Project Overview
Personal prompt management system. Save, search (hybrid semantic + FTS), and adapt prompts using LLM. Built with Next.js 15 App Router + TypeScript + Supabase + pgvector.

## Stack
- **Framework**: Next.js 15, App Router, TypeScript strict mode
- **Database**: Supabase (Postgres + pgvector)
- **Embeddings**: OpenRouter `text-embedding-3-small` (384-dim) via `openai` SDK — same API key as LLM
- **LLM**: OpenRouter via `openai` SDK with baseURL override (`OPENROUTER_API_KEY` + `OPENROUTER_MODEL` in env)
- **Styling**: Tailwind CSS

## Key Architecture Decisions
- Embeddings are generated **synchronously** on `POST /api/prompts` and `PATCH /api/prompts/[id]` (when any searchable field changes)
- Embedding text includes title, summary, category, tags, use_cases, body, notes — all labeled (e.g. `Title: ...`) for better retrieval
- Default search is **always free** — no LLM on the search path. Hybrid = vector cosine (80%) + FTS boolean match (20%)
- LLM is called in `/api/adapt` (adaptation) and optionally in search reranking (`?rerank=1` — reorders top-20 candidates by relevance)
- `prompt_versions` stores full JSONB snapshots of the prompt row on every edit
- `prompt_variants` stores `frozen_body` (parent body at creation time) + `adapted_body` (immutable output)
- Variable placeholders use `{{variable_name}}` syntax only — no nesting

## Folder Structure
```
app/                    Next.js App Router pages + API routes
lib/
  supabase/             Browser + server Supabase clients
  embeddings/           Local embedding pipeline (pipeline.ts)
  search/               vector.ts, fts.ts, scoring.ts, rerank.ts
  adaptation/           variables.ts (extract/detect), llm.ts (OpenRouter)
  types.ts              All shared TypeScript types
components/             React components (prompt-card, prompt-form, search-bar, adapt-flow)
supabase/migrations/    SQL migrations (run manually via Supabase dashboard or CLI)
scripts/                seed.ts, embed.ts, reindex.ts (run with: npm run seed/embed/reindex)
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (default: `anthropic/claude-haiku-4-5`)

## Database Setup
1. Create a new Supabase project
2. Run migrations in order via Supabase SQL Editor or `supabase db push`:
   - `supabase/migrations/001_enable_pgvector.sql`
   - `supabase/migrations/002_initial_schema.sql`

## Running Scripts
```bash
npm run seed      # Insert example prompts
npm run embed     # Generate embeddings for all prompts missing them
npm run reindex   # Re-embed ALL prompts (run after model or schema changes)
```

## Variable System
Prompts can contain `{{variable_name}}` placeholders. Variables are defined in:
- `required_variables`: `[{ name, type, required: true, description?, options? }]`
- `optional_variables`: `[{ name, type, required: false, description?, default? }]`

Types: `text` (short), `long_text` (textarea), `choice` (dropdown from `options[]`)

## Preferences
- Keep it simple — no over-engineering
- Do not add features beyond what is asked
- Do not add unnecessary comments or docstrings
- TypeScript strict mode throughout
- Tailwind for all styling — no CSS modules or styled-components
- Dark theme (zinc-950 background)
