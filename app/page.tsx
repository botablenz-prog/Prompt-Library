export const runtime = "nodejs";
export const maxDuration = 60;

import { createAnonClient } from "@/lib/supabase/anon";
import { PromptCard } from "@/components/prompt-card";
import { SearchBar } from "@/components/search-bar";
import { embed } from "@/lib/embeddings/pipeline";
import { runVectorSearch } from "@/lib/search/vector";
import { runFTSSearch } from "@/lib/search/fts";
import { mergeResults } from "@/lib/search/scoring";
import { rerankResults } from "@/lib/search/rerank";
import { getUser, getRole } from "@/lib/auth/session";
import { PromptList } from "@/components/prompt-list";
import type { Prompt, SearchResult } from "@/lib/types";

interface Props {
  searchParams: Promise<{ q?: string; rerank?: string }>;
}

async function getPrompts(query?: string, rerank?: boolean): Promise<(Prompt | SearchResult)[]> {
  if (query?.trim()) {
    const supabase = createAnonClient();
    let queryVec: number[] | null = null;
    let ftsSet: Awaited<ReturnType<typeof runFTSSearch>>;
    try {
      [queryVec, ftsSet] = await Promise.all([
        embed(query),
        runFTSSearch(query),
      ]);
    } catch {
      // Embedding failed — fall back to FTS-only search
      queryVec = null;
      ftsSet = await runFTSSearch(query);
    }
    const vectorResults = queryVec ? await runVectorSearch(queryVec) : [];
    const ranked = mergeResults(vectorResults, ftsSet);
    if (ranked.length === 0) return [];

    const topIds = ranked.slice(0, 20).map((r) => r.id);
    const scoreMap = new Map(ranked.map((r) => [r.id, r.score]));
    const { data } = await supabase
      .from("prompts")
      .select(
        "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
      )
      .in("id", topIds);

    const candidates = (data ?? []) as Prompt[];

    if (rerank && candidates.length > 0) {
      const rerankedIds = await rerankResults(query, candidates);
      const idIndex = new Map(candidates.map((p) => [p.id, p]));
      return rerankedIds
        .slice(0, 10)
        .map((id) => idIndex.get(id))
        .filter(Boolean) as Prompt[];
    }

    return candidates
      .slice(0, 10)
      .map((p) => ({ ...p, score: scoreMap.get(p.id) ?? 0 }))
      .sort((a, b) => (b as SearchResult).score - (a as SearchResult).score);
  }

  const supabase = createAnonClient();
  const { data } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
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
