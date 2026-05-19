-- Migration 005: retrieval metadata
-- Adds topic, series, search_aliases — the three optional fields that let
-- broad-family queries cluster and let users find prompts by approximate
-- words / intent / nickname (not just title tokens).
--
-- All three columns are nullable / empty by default. Existing prompts are
-- untouched until the backfill script runs. No data is altered by this
-- migration; only the schema is extended.

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS topic           text,
  ADD COLUMN IF NOT EXISTS series          text,
  ADD COLUMN IF NOT EXISTS search_aliases  text[] NOT NULL DEFAULT '{}';

-- Partial b-tree indexes for filter queries (only index rows where the
-- field is non-null; saves space and matches the filter UI semantics).
CREATE INDEX IF NOT EXISTS prompts_topic_idx
  ON prompts(topic) WHERE topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS prompts_series_idx
  ON prompts(series) WHERE series IS NOT NULL;

-- GIN index for array-contains queries against aliases (used by filter UI
-- and by future Phase 4 scoring boosts).
CREATE INDEX IF NOT EXISTS prompts_search_aliases_idx
  ON prompts USING GIN (search_aliases);
