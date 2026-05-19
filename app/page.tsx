export const runtime = "nodejs";
export const maxDuration = 60;

import { createAnonClient } from "@/lib/supabase/anon";
import { PromptCard } from "@/components/prompt-card";
import { SearchBar } from "@/components/search-bar";
import { embed } from "@/lib/embeddings/pipeline";
import { runVectorSearch } from "@/lib/search/vector";
import { runFTSSearch } from "@/lib/search/fts";
import { scoreCandidates, type CandidateRow } from "@/lib/search/scoring";
import { rerankResults } from "@/lib/search/rerank";
import { getUser, getRole } from "@/lib/auth/session";
import { PromptList } from "@/components/prompt-list";
import type { Prompt, SearchResult } from "@/lib/types";

interface Props {
  searchParams: Promise<{ q?: string; rerank?: string }>;
}

const CANDIDATE_SELECT =
  "id, title, summary, body, required_variables, optional_variables, tags, category, topic, series, search_aliases, use_cases, notes, created_at, updated_at";

async function getPrompts(query?: string, rerank?: boolean): Promise<(Prompt | SearchResult)[]> {
  if (query?.trim()) {
    const supabase = createAnonClient();
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

    const candidateIds = new Set<string>([...vecScoreMap.keys(), ...ftsScores.keys()]);
    if (candidateIds.size === 0) return [];

    const { data } = await supabase
      .from("prompts")
      .select(CANDIDATE_SELECT)
      .in("id", Array.from(candidateIds));

    const rows = (data ?? []) as (Prompt & CandidateRow)[];
    const scored = scoreCandidates(query, rows, vecScoreMap, ftsScores);

    if (rerank && rows.length > 0) {
      const rerankedIds = await rerankResults(query, rows);
      const idIndex = new Map(rows.map((p) => [p.id, p]));
      return rerankedIds
        .slice(0, 10)
        .map((id) => idIndex.get(id))
        .filter(Boolean) as Prompt[];
    }

    const promptById = new Map(rows.map((r) => [r.id, r]));
    return scored
      .slice(0, 10)
      .map((s): SearchResult => ({
        ...(promptById.get(s.id)!),
        score: s.score,
        matchSignals: s.matchSignals,
      }));
  }

  const supabase = createAnonClient();
  const { data } = await supabase
    .from("prompts")
    .select(CANDIDATE_SELECT)
    .order("updated_at", { ascending: false })
    .range(0, 19);

  return (data ?? []) as Prompt[];
}

export default async function HomePage({ searchParams }: Props) {
  const { q: query, rerank } = await searchParams;
  const [user] = await Promise.all([getUser()]);
  const isAdmin = getRole(user) === "admin";
  const isReranked = rerank === "1" && isAdmin;
  const prompts = await getPrompts(query, isReranked);

  return (
    <div className="space-y-6">
      <SearchBar defaultValue={query ?? ""} />

      {query && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {prompts.length} result{prompts.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            {isReranked && <span className="ml-2 text-zinc-400">(ranking improved)</span>}
          </p>
          {isAdmin && !isReranked && prompts.length > 0 && (
            <a
              href={`/?q=${encodeURIComponent(query)}&rerank=1`}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
            >
              Improve ranking
            </a>
          )}
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-500">
            {query ? "No prompts matched your search." : "No prompts yet."}
          </p>
          {isAdmin && (
            <a
              href="/prompts/new"
              className="mt-4 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              + Create your first prompt
            </a>
          )}
        </div>
      ) : query ? (
        <div className="grid gap-3">
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      ) : (
        <PromptList initialPrompts={prompts as Prompt[]} isAdmin={isAdmin} />
      )}
    </div>
  );
}
