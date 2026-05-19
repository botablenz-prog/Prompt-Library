import type { VectorResult } from "./vector";

export interface ScoredResult {
  id: string;
  score: number;
}

// Hybrid scoring — Phase 3 (forward-compatible shape, behaviour preserved).
//
// final_score = vec_score * 0.8 + (fts_match ? 0.2 : 0)
//
// FTS now returns a real ts_rank_cd score per id (Map<id, score>) rather
// than a bare Set<string>. Phase 3 still treats FTS as a flat 0.2 bonus to
// avoid re-baselining ranking before Phase 5 introduces multi-signal
// scoring; the score value is captured but not yet weighted into the sum.
//
// FTS-only results (prompts with no embedding, or outside the top vector
// candidate set) are included with score 0.2.
export function mergeResults(
  vectorResults: VectorResult[],
  ftsScores: Map<string, number>
): ScoredResult[] {
  const seenIds = new Set<string>();
  const scored: ScoredResult[] = [];

  for (const { id, vec_score } of vectorResults) {
    seenIds.add(id);
    scored.push({ id, score: vec_score * 0.8 + (ftsScores.has(id) ? 0.2 : 0) });
  }

  for (const id of ftsScores.keys()) {
    if (!seenIds.has(id)) {
      scored.push({ id, score: 0.2 });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}
