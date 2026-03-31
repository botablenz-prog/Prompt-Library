import type { VectorResult } from "./vector";

export interface ScoredResult {
  id: string;
  score: number;
}

// Weighted hybrid scoring:
//   final_score = (vec_score * 0.8) + (fts_match ? 0.2 : 0.0)
// Vector score is cosine similarity (0–1). FTS adds a flat 0.2 bonus.
export function mergeResults(
  vectorResults: VectorResult[],
  ftsSet: Set<string>
): ScoredResult[] {
  const scored = vectorResults.map(({ id, vec_score }) => ({
    id,
    score: vec_score * 0.8 + (ftsSet.has(id) ? 0.2 : 0),
  }));

  return scored.sort((a, b) => b.score - a.score);
}
