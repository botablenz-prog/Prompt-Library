-- RPC function for vector similarity search
-- Called by lib/search/vector.ts
CREATE OR REPLACE FUNCTION search_by_embedding(
  query_embedding vector(384),
  match_count     int DEFAULT 20
)
RETURNS TABLE (
  id        uuid,
  vec_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    1 - (embedding <=> query_embedding) AS vec_score
  FROM prompts
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
