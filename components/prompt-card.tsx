"use client";

import Link from "next/link";
import type { Prompt, SearchResult } from "@/lib/types";

interface Props {
  prompt: Prompt | SearchResult;
}

export function PromptCard({ prompt }: Props) {
  const score = "score" in prompt ? prompt.score : null;

  return (
    <Link
      href={`/prompts/${prompt.id}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{prompt.title}</h2>
          {prompt.summary && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{prompt.summary}</p>
          )}
        </div>
        {score !== null && (
          <span className="shrink-0 text-xs text-zinc-600 tabular-nums">
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {prompt.category && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400">
            {prompt.category}
          </span>
        )}
        {prompt.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-500"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
        {prompt.required_variables.length > 0 && (
          <span>{prompt.required_variables.length} required var{prompt.required_variables.length !== 1 ? "s" : ""}</span>
        )}
        <span>{new Date(prompt.updated_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
