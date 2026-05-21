export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";
import { embed } from "@/lib/embeddings/pipeline";
import { runVectorSearch } from "@/lib/search/vector";
import { runFTSSearch } from "@/lib/search/fts";
import { scoreCandidates, type CandidateRow } from "@/lib/search/scoring";
import { applyFilters, type SearchFilters } from "@/lib/search/facets";
import type { Prompt, SearchResult } from "@/lib/types";

const CANDIDATE_SELECT =
  "id, title, summary, body, required_variables, optional_variables, tags, category, topic, series, search_aliases, use_cases, notes, created_at, updated_at";

// GET /api/search?q=<query>
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    if (query.length > 1000) {
      return NextResponse.json({ error: "Query too long (max 1000 characters)" }, { status: 400 });
    }

    if (req.nextUrl.searchParams.get("rerank") === "1") {
      const guard = await requireAdmin();
      if (guard instanceof NextResponse) return guard;
    }

    const filters: SearchFilters = {
      topic:    req.nextUrl.searchParams.get("topic")    ?? undefined,
      category: req.nextUrl.searchParams.get("category") ?? undefined,
      series:   req.nextUrl.searchParams.get("series")   ?? undefined,
      hasVars:  req.nextUrl.searchParams.get("hasVars")  === "1",
    };

    const supabase = createAnonClient();

    // Run embedding + FTS in parallel; fall back to FTS-only if embedding fails
    let queryVec: number[] | null = null;
    let ftsScores: Map<string, number>;
    try {
      [queryVec, ftsScores] = await Promise.all([
        embed(query),
        runFTSSearch(query),
      ]);
    } catch {
      queryVec = null;
      ftsScores = await runFTSSearch(query);
    }

    const vectorResults = queryVec ? await runVectorSearch(queryVec) : [];

    const vecScoreMap = new Map<string, number>();
    for (const v of vectorResults) vecScoreMap.set(v.id, v.vec_score);

    // Union of vector and FTS candidate IDs — up to 100 rows at default limits
    const candidateIds = new Set<string>([
      ...vecScoreMap.keys(),
      ...ftsScores.keys(),
    ]);

    if (candidateIds.size === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("prompts")
      .select(CANDIDATE_SELECT)
      .in("id", Array.from(candidateIds));

    if (error) {
      console.error("[GET /api/search]", error.code ?? error.name);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const rows = (data ?? []) as (Prompt & CandidateRow)[];
    const filtered = applyFilters(rows, filters);
    const scored = scoreCandidates(query, filtered, vecScoreMap, ftsScores);

    const promptById = new Map(filtered.map((r) => [r.id, r]));
    const results: SearchResult[] = scored
      .slice(0, 10)
      .map((s) => ({ ...(promptById.get(s.id)!), score: s.score, matchSignals: s.matchSignals }));

    return NextResponse.json(results);
  } catch (err) {
    const e = err as { code?: string; name?: string };
    console.error("[GET /api/search]", e?.code ?? e?.name ?? "unknown");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
