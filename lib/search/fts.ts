import { createAnonClient } from "@/lib/supabase/anon";

// Returns a map of prompt id -> ts_rank_cd score for prompts matching the
// query. Uses the `search_by_fts` RPC (migration 006) which runs
// websearch_to_tsquery + ts_rank_cd against the weighted fts column
// (migration 007).
//
// Empty map = no matches. Backward-compatible with the previous Set<string>
// shape via `ftsScores.has(id)` checks; Phase 5 will use the score value.
export async function runFTSSearch(query: string, limit = 20): Promise<Map<string, number>> {
  const supabase = createAnonClient();

  const { data, error } = await supabase.rpc("search_by_fts", {
    query_text: query,
    match_count: limit,
  });

  if (error) throw new Error(`FTS search failed: ${error.message}`);

  const scores = new Map<string, number>();
  for (const row of (data ?? []) as { id: string; fts_score: number }[]) {
    scores.set(row.id, row.fts_score);
  }
  return scores;
}
