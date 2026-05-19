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
import { getFacets, applyFilters, type SearchFilters } from "@/lib/search/facets";
import { getUser, getRole } from "@/lib/auth/session";
import { PromptList } from "@/components/prompt-list";
import type { Prompt, SearchResult } from "@/lib/types";

interface Props {
  searchParams: Promise<{
    q?: string;
    rerank?: string;
    topic?: string;
    category?: string;
    series?: string;
    hasVars?: string;
  }>;
}

const CANDIDATE_SELECT =
  "id, title, summary, body, required_variables, optional_variables, tags, category, topic, series, search_aliases, use_cases, notes, created_at, updated_at";

async function getPrompts(
  query: string | undefined,
  rerank: boolean,
  filters: SearchFilters
): Promise<(Prompt | SearchResult)[]> {
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
    const filtered = applyFilters(rows, filters);
    const scored = scoreCandidates(query, filtered, vecScoreMap, ftsScores);

    if (rerank && filtered.length > 0) {
      const rerankedIds = await rerankResults(query, filtered);
      const idIndex = new Map(filtered.map((p) => [p.id, p]));
      return rerankedIds
        .slice(0, 10)
        .map((id) => idIndex.get(id))
        .filter(Boolean) as Prompt[];
    }

    const promptById = new Map(filtered.map((r) => [r.id, r]));
    return scored
      .slice(0, 10)
      .map((s): SearchResult => ({
        ...(promptById.get(s.id)!),
        score: s.score,
        matchSignals: s.matchSignals,
      }));
  }

  // Browse mode (no query): list 20 most recent, applying filters.
  // hasVars needs JSONB-length filtering done in JS, so fetch wider then trim.
  const needsJsFilter = filters.hasVars;
  const supabase = createAnonClient();
  let q = supabase
    .from("prompts")
    .select(CANDIDATE_SELECT)
    .order("updated_at", { ascending: false });
  if (filters.topic)    q = q.eq("topic", filters.topic);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.series)   q = q.eq("series", filters.series);
  const { data } = await q.range(0, needsJsFilter ? 99 : 19);
  const rows = (data ?? []) as Prompt[];
  return applyFilters(rows, filters).slice(0, 20);
}

export default async function HomePage({ searchParams }: Props) {
  const { q: query, rerank, topic, category, series, hasVars } = await searchParams;
  const filters: SearchFilters = {
    topic:    topic    || undefined,
    category: category || undefined,
    series:   series   || undefined,
    hasVars:  hasVars === "1",
  };
  const filtersActive = !!(filters.topic || filters.category || filters.series || filters.hasVars);

  const [user, facets] = await Promise.all([getUser(), getFacets()]);
  const isAdmin = getRole(user) === "admin";
  const isReranked = rerank === "1" && isAdmin;
  const prompts = await getPrompts(query, isReranked, filters);

  return (
    <div className="space-y-6">
      <SearchBar
        defaultValue={query ?? ""}
        facets={facets}
        filters={filters}
      />

      {(query || filtersActive) && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {prompts.length} result{prompts.length !== 1 ? "s" : ""}
            {query && <> for &ldquo;{query}&rdquo;</>}
            {isReranked && <span className="ml-2 text-zinc-400">(ranking improved)</span>}
          </p>
          {isAdmin && query && !isReranked && prompts.length > 0 && (
            <a
              href={`/?q=${encodeURIComponent(query)}&rerank=1${filters.topic ? `&topic=${encodeURIComponent(filters.topic)}` : ""}${filters.category ? `&category=${encodeURIComponent(filters.category)}` : ""}${filters.series ? `&series=${encodeURIComponent(filters.series)}` : ""}${filters.hasVars ? "&hasVars=1" : ""}`}
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
            {query || filtersActive
              ? "No prompts matched. Try removing a filter or broadening the query."
              : "No prompts yet."}
          </p>
          {isAdmin && !query && !filtersActive && (
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
