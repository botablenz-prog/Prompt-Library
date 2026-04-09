"use client";

import { useState } from "react";
import { PromptCard } from "@/components/prompt-card";
import type { Prompt } from "@/lib/types";

const PAGE_SIZE = 10;

interface Props {
  initialPrompts: Prompt[];
  isAdmin: boolean;
}

export function PromptList({ initialPrompts, isAdmin }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPrompts.length === 20);

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/prompts?offset=${prompts.length}&limit=${PAGE_SIZE}`);
      if (!res.ok) return;
      const next: Prompt[] = await res.json();
      if (!Array.isArray(next)) return;
      setPrompts((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch {
      // leave list unchanged on error
    } finally {
      setLoading(false);
    }
  }

  if (prompts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-zinc-500">No prompts yet.</p>
        {isAdmin && (
          <a
            href="/prompts/new"
            className="mt-4 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            + Create your first prompt
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {prompts.map((p) => (
          <PromptCard key={p.id} prompt={p} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-zinc-700 px-5 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
