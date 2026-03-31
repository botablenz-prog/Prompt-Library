I want to build a new project called Prompt Library.

The goal is to create a practical prompt library for my own use first, but with a codebase clean enough that it could later become a product.

Core idea:
- I save prompts I use often
- I can search them by meaning, not just exact keywords
- The system can ask me a few smart follow-up questions
- It can then auto-adapt a saved prompt for my current task
- I can save the adapted version as a new variant if I want

Important constraints:
- Keep costs low
- Use a fresh Supabase project for this MVP
- Prefer simple, maintainable architecture over fancy complexity
- Do not overbuild
- Do not create unnecessary infrastructure
- Make reasonable assumptions and move forward unless something is truly blocking
- Explain tradeoffs clearly when needed

Tech direction I want:
- Frontend: Next.js + TypeScript
- Database: Supabase Postgres
- Semantic search: pgvector in Supabase
- Search approach: hybrid search = full-text + vector search
- Embeddings: use a low-cost / local-first approach if possible
- Prompt adaptation: design the system so LLM calls only happen when needed, not on every search
- UI should be simple, clean, fast, and good enough for daily use

What I want you to do first:
1. Think like a senior product engineer and propose the leanest MVP architecture.
2. Briefly explain the recommended stack and why it is the best cost/value choice.
3. Define the MVP scope and clearly separate:
   - must-have
   - should-have later
   - not now
4. Propose the database schema.
5. Propose the folder structure.
6. Propose the search flow.
7. Propose the prompt adaptation flow.
8. Propose how to keep usage cost low.
9. Then scaffold the actual project.

Product requirements for MVP:
- Create, edit, delete, and view saved prompts
- Each prompt should have:
  - title
  - summary
  - main prompt body
  - tags
  - category
  - use cases
  - required variables
  - optional variables
  - notes
  - created at / updated at
- Semantic search over prompts
- Keyword search over prompts
- Hybrid ranking of results
- A prompt detail page
- A “Use this prompt” flow
- The system should detect missing variables and ask follow-up questions
- Then generate an adapted prompt using the saved prompt + user context
- Let me copy the adapted prompt easily
- Let me save the adapted prompt as a variant
- Keep version history simple but clean

Very important product behavior:
- Searching should be cheap
- Do NOT call an LLM just to search
- LLM should only be used for adaptation/refinement when needed
- If enough variables are already provided, adapt directly
- If important variables are missing, ask the minimum number of questions
- Make the UX feel like “find best prompt -> fill gaps -> produce ready-to-use prompt”

Cost control requirements:
- Assume I want to stay as close to free/cheap as possible
- Avoid paid services unless there is a very strong reason
- Prefer local embedding generation or batch embedding jobs over expensive per-request APIs
- Do not embed repeatedly if the prompt has not changed
- Add a clean embedding pipeline that can be swapped later
- Design so we can start with cheap embeddings and upgrade later
- Keep the LLM integration modular so I can switch providers later

Implementation preference:
- Use migrations properly
- Keep code modular
- Keep types strict
- Add sensible comments
- Add a README that explains setup, architecture, and next steps
- Add a seed script with a few example prompts
- Add a script to generate embeddings for prompts
- Add a script to reindex / refresh embeddings

Search/retrieval design expectations:
- Recommend an embedding model suitable for low-cost semantic search
- Explain whether to use 384 or 768 dimensions and choose one
- Implement hybrid retrieval in a practical way
- Include a clear ranking strategy
- Include a simple explanation for why a result matched, if feasible

Adaptation flow expectations:
- Saved prompts should support variables/placeholders
- The app should detect missing variables
- Ask follow-up questions only when necessary
- Generate an adapted prompt with a clean final output
- Keep original prompt and adapted variant linked
- Store variants in a sensible way

Suggested pages/screens:
- prompt list page
- prompt detail page
- create/edit prompt page
- use/adapt prompt page

Please work in phases:
Phase 1:
- architecture
- schema
- folder structure
- setup
- scaffold app
- Supabase integration
- CRUD
- seed data

Phase 2:
- pgvector setup
- embedding pipeline
- hybrid search
- result ranking

Phase 3:
- prompt adaptation flow
- follow-up question logic
- save variants

Phase 4:
- polish UI
- improve DX
- README
- cleanup

Important:
- Before writing code, give me a short implementation plan and key assumptions.
- Then start building immediately.
- Do not stop at high-level advice only.
- Make real progress.
- If there are multiple valid options, choose the simplest one that keeps future flexibility.
- If something is unclear, make a reasonable default choice and document it.

One more thing:
I do NOT want a giant enterprise prompt platform.
I want a sharp, useful MVP for personal use that can later grow into a product.

Please begin by:
1. summarizing the architecture you recommend
2. listing the MVP scope
3. listing the database schema
4. then scaffolding the project