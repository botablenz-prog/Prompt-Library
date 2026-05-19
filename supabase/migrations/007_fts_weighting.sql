-- Migration 007: weighted FTS index
--
-- Rewrites the trigger that maintains the `fts` tsvector. Today it builds
-- one flat tsvector from title || summary || body || category || tags
-- (no weighting). A body hit therefore looks identical to a title hit.
--
-- New design uses setweight A/B/C/D so that:
--   A: title, search_aliases, topic, series          (highest)
--   B: summary, use_cases, tags, category
--   C: variable names, notes
--   D: body                                          (lowest)
--
-- Combined with ts_rank_cd in migration 006, a title hit will now rank
-- substantially above a body hit for the same query.

CREATE OR REPLACE FUNCTION update_prompts_fts()
RETURNS TRIGGER AS $$
DECLARE
  var_names text;
BEGIN
  -- Extract variable names from both required and optional JSONB arrays.
  -- We index names only (not the full variable JSON) to keep the signal clean.
  SELECT string_agg(coalesce((vd->>'name'), ''), ' ') INTO var_names
  FROM (
    SELECT jsonb_array_elements(NEW.required_variables) AS vd
    UNION ALL
    SELECT jsonb_array_elements(NEW.optional_variables) AS vd
  ) v;

  NEW.fts :=
    setweight(to_tsvector('english',
      coalesce(NEW.title, '') || ' ' ||
      array_to_string(NEW.search_aliases, ' ') || ' ' ||
      coalesce(NEW.topic, '') || ' ' ||
      coalesce(NEW.series, '')
    ), 'A') ||
    setweight(to_tsvector('english',
      coalesce(NEW.summary, '') || ' ' ||
      array_to_string(NEW.use_cases, ' ') || ' ' ||
      array_to_string(NEW.tags, ' ') || ' ' ||
      coalesce(NEW.category, '')
    ), 'B') ||
    setweight(to_tsvector('english',
      coalesce(var_names, '') || ' ' ||
      coalesce(NEW.notes, '')
    ), 'C') ||
    setweight(to_tsvector('english',
      coalesce(NEW.body, '')
    ), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself is already attached from migration 002; CREATE OR
-- REPLACE FUNCTION above updates it in place, so we DROP/CREATE the trigger
-- explicitly to be defensive against any earlier installation drift.
DROP TRIGGER IF EXISTS prompts_fts_update ON prompts;
CREATE TRIGGER prompts_fts_update
  BEFORE INSERT OR UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_prompts_fts();

-- Recompute fts for all existing rows so the new weighting takes effect.
-- Disable updated_at trigger first so this maintenance write doesn't bump
-- every row's "last edited" timestamp (history matters).
ALTER TABLE prompts DISABLE TRIGGER prompts_updated_at;

-- Forces the BEFORE UPDATE trigger to fire on every row. Postgres invokes
-- BEFORE UPDATE triggers even when the new column value equals the old,
-- so writing title back to itself is a safe way to recompute fts.
UPDATE prompts SET title = title;

ALTER TABLE prompts ENABLE TRIGGER prompts_updated_at;
