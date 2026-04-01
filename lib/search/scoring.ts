import type { VectorResult } from "./vector";

export interface ScoredResult {
  id: string;
  score: number;
}

// Weighted hybrid scoring:
//   final_score = (vec_score * 0.8) + (fts_match ? 0.2 : 0.0)
// Vector score is cosine similarity (0–1). FTS adds a flat 0.2 bonus.
// FTS-only results (no embedding) are included with score 0.2.
export function mergeResults(
  vectorResults: VectorResult[],
  ftsSet: Set<string>
): ScoredResult[] {
  const seenIds = new Set<string>();
  const scored: ScoredResult[] = [];

  for (const { id, vec_score } of vectorResults) {
    seenIds.add(id);
    scored.push({ id, score: vec_score * 0.8 + (ftsSet.has(id) ? 0.2 : 0) });
  }

  // Include FTS-only matches (prompts with no embedding or outside top vector results)
  for (const id of ftsSet) {
    if (!seenIds.has(id)) {
      scored.push({ id, score: 0.2 });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}
