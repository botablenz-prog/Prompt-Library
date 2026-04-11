export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";
import { embed } from "@/lib/embeddings/pipeline";
import { runVectorSearch } from "@/lib/search/vector";
import { runFTSSearch } from "@/lib/search/fts";
import { mergeResults } from "@/lib/search/scoring";
import type { Prompt } from "@/lib/types";

// GET /api/search?q=<query>
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  if (query.length > 1000) {
    return NextResponse.json({ error: "Query too long (max 1000 characters)" }, { status: 400 });
  }

  // Reranking triggers an LLM call — require admin
  if (req.nextUrl.searchParams.get("rerank") === "1") {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;
  }

  const supabase = createAnonClient();

  // Run embedding + FTS in parallel
  const [queryVec, ftsSet] = await Promise.all([
    embed(query),
    runFTSSearch(query),
  ]);

  const vectorResults = await runVectorSearch(queryVec);
  const ranked = mergeResults(vectorResults, ftsSet);

  if (ranked.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch full prompt rows for top 10 results
  const topIds = ranked.slice(0, 10).map((r) => r.id);
  const scoreMap = new Map(ranked.map((r) => [r.id, r.score]));

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .in("id", topIds);

  if (error) {
    console.error("[GET /api/search]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  // Re-sort by score (DB .in() doesn't preserve order)
  const results = (data as Prompt[])
    .map((p) => ({ ...p, score: scoreMap.get(p.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json(results);
}
