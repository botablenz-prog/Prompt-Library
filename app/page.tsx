import { createServerClient } from "@/lib/supabase/server";
import { PromptCard } from "@/components/prompt-card";
import { SearchBar } from "@/components/search-bar";
import type { Prompt, SearchResult } from "@/lib/types";

interface Props {
  searchParams: { q?: string };
}

async function getPrompts(query?: string): Promise<(Prompt | SearchResult)[]> {
  if (query?.trim()) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/search?q=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  return (data ?? []) as Prompt[];
}

export default async function HomePage({ searchParams }: Props) {
  const query = searchParams.q;
  const prompts = await getPrompts(query);

  return (
    <div className="space-y-6">
      <SearchBar defaultValue={query ?? ""} />

      {query && (
        <p className="text-xs text-zinc-500">
          {prompts.length} result{prompts.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </p>
      )}

      {prompts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-500">
            {query ? "No prompts matched your search." : "No prompts yet."}
          </p>
          <a
            href="/prompts/new"
            className="mt-4 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            + Create your first prompt
          </a>
        </div>
      ) : (
        <div className="grid gap-3">
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      )}
    </div>
  );
}
