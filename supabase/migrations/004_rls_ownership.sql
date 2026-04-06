-- Migration 004: RLS ownership
-- Adds user_id to prompts and prompt_variants, enables RLS on all three
-- tables, and creates policies for the single-admin MVP.

-- ============================================================
-- 1. Ownership columns (nullable for safe migration of existing data)
-- ============================================================

ALTER TABLE prompts
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE prompt_variants
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- prompt_versions ownership is derived via parent JOIN (see policies below).

-- ============================================================
-- 2. Indexes
-- ============================================================

-- RLS performance: UPDATE/DELETE policies filter by user_id
CREATE INDEX prompts_user_id_idx ON prompts(user_id);
CREATE INDEX prompt_variants_user_id_idx ON prompt_variants(user_id);

-- Query performance: getVariants() filters variants by parent_id
CREATE INDEX prompt_variants_parent_id_idx ON prompt_variants(parent_id);

-- RLS performance: version policies JOIN on prompt_id
CREATE INDEX prompt_versions_prompt_id_idx ON prompt_versions(prompt_id);

-- ============================================================
-- 3. Enable RLS
-- ============================================================

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Policies: prompts
-- ============================================================

-- MVP: all prompts are public.
-- To restrict later, replace USING (true) with one of:
--   USING (auth.uid() IS NOT NULL)            -- authenticated users only
--   USING (auth.uid() = user_id)              -- owner-only (private library)
--   USING (is_public OR auth.uid() = user_id) -- mixed (add is_public column first)
CREATE POLICY "read_prompts"
  ON prompts FOR SELECT USING (true);

CREATE POLICY "admin_insert_prompts"
  ON prompts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_update_prompts"
  ON prompts FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_delete_prompts"
  ON prompts FOR DELETE
  USING (
    auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- 5. Policies: prompt_variants
-- ============================================================

-- MVP: all variants are public. Evolve in lock-step with read_prompts.
CREATE POLICY "read_variants"
  ON prompt_variants FOR SELECT USING (true);

CREATE POLICY "admin_insert_variants"
  ON prompt_variants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_delete_variants"
  ON prompt_variants FOR DELETE
  USING (
    auth.uid() = user_id
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- 6. Policies: prompt_versions (ownership via parent JOIN)
-- ============================================================

CREATE POLICY "owner_read_versions"
  ON prompt_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = prompt_versions.prompt_id
        AND prompts.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_versions"
  ON prompt_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = prompt_id
        AND prompts.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. Grant anon/authenticated access to search RPC
-- ============================================================

GRANT EXECUTE ON FUNCTION search_by_embedding TO anon, authenticated;
