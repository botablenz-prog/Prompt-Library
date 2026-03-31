-- ============================================================
-- prompts — the core table
-- Variables use {{variable_name}} syntax in body.
-- required_variables / optional_variables are JSONB arrays of:
--   { name: string, type: 'text'|'long_text'|'choice', required: boolean, options?: string[] }
-- ============================================================
CREATE TABLE prompts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  summary             text,
  body                text NOT NULL,
  required_variables  jsonb NOT NULL DEFAULT '[]',
  optional_variables  jsonb NOT NULL DEFAULT '[]',
  tags                text[] NOT NULL DEFAULT '{}',
  category            text,
  use_cases           text[] NOT NULL DEFAULT '{}',
  notes               text,
  -- embedding populated synchronously on create/update, null until first save
  embedding           vector(384),
  -- fts maintained by trigger below (generated columns can't use to_tsvector in Supabase)
  fts                 tsvector,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- GIN index for fast FTS; no ivfflat needed at <1000 prompts (exact scan is fine)
CREATE INDEX prompts_fts_idx ON prompts USING GIN (fts);

-- ============================================================
-- prompt_variants — adapted/filled versions of a prompt
-- frozen_body: snapshot of parent body at variant creation time
-- adapted_body: the final adapted output (static, never changes)
-- ============================================================
CREATE TABLE prompt_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  title         text,
  frozen_body   text NOT NULL,   -- parent body at time of creation
  adapted_body  text NOT NULL,   -- the final adapted prompt output
  context_used  jsonb NOT NULL DEFAULT '{}',  -- variables/context that were filled
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- prompt_versions — full snapshots on every edit
-- ============================================================
CREATE TABLE prompt_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id   uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  snapshot    jsonb NOT NULL,    -- complete prompt row at time of edit
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Trigger: keep fts column updated on insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION update_prompts_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    coalesce(NEW.body, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    array_to_string(NEW.tags, ' '));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompts_fts_update
  BEFORE INSERT OR UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_prompts_fts();

-- ============================================================
-- Trigger: auto-update updated_at on every update
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
