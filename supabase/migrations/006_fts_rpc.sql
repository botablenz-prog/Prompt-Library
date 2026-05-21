-- Migration 006: ranked keyword search RPC
--
-- Replaces the JS-side `supabase.from(...).textSearch(...)` call (which only
-- returned a yes/no match) with a real ranking signal via ts_rank_cd.
--
-- Uses websearch_to_tsquery so we can pass raw user input directly: it
-- handles spaces, quoted phrases, and `-exclude` operators safely.
-- Falls back to plainto_tsquery semantics for simple queries.

CREATE OR REPLACE FUNCTION search_by_fts(
  query_text  text,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id        uuid,
  fts_score float
)
LANGUAGE sql STABLE
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', query_text) AS tsq
  )
  SELECT p.id, ts_rank_cd(p.fts, q.tsq) AS fts_score
  FROM prompts p, q
  WHERE p.fts @@ q.tsq
  ORDER BY fts_score DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION search_by_fts TO anon, authenticated;
