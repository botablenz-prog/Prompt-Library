"use client";

import Link from "next/link";
import type { Prompt, SearchResult, MatchSignals } from "@/lib/types";

interface Props {
  prompt: Prompt | SearchResult;
}

const SIGNAL_LABELS: { key: keyof MatchSignals; label: string }[] = [
  { key: "title",     label: "title" },
  { key: "aliases",   label: "aliases" },
  { key: "topic",     label: "topic" },
  { key: "series",    label: "series" },
  { key: "use_cases", label: "use case" },
  { key: "tags",      label: "tags" },
  { key: "variables", label: "variables" },
  { key: "summary",   label: "summary" },
  { key: "body",      label: "body" },
];

function matchedOnLabel(signals: MatchSignals): string | null {
  const hits = SIGNAL_LABELS.filter(({ key }) => signals[key]).map(({ label }) => label);
  if (hits.length === 0) return null;
  return hits.slice(0, 4).join(", ");
}

export function PromptCard({ prompt }: Props) {
  const isSearchResult = "matchSignals" in prompt;
  const score = isSearchResult ? (prompt as SearchResult).score : null;
  const matchedOn = isSearchResult ? matchedOnLabel((prompt as SearchResult).matchSignals) : null;

  const variableNames = [
    ...(prompt.required_variables ?? []),
    ...(prompt.optional_variables ?? []),
  ].map((v) => v.name).filter(Boolean);

  const firstUseCase = isSearchResult ? prompt.use_cases?.[0] : null;

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

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {prompt.topic && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-200">
            {prompt.topic}
          </span>
        )}
        {prompt.category && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400">
            {prompt.category}
          </span>
        )}
        {prompt.series && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-300 italic">
            {prompt.series}
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

      {firstUseCase && (
        <p className="mt-2 text-xs text-zinc-500 line-clamp-1">
          <span className="text-zinc-600">Use case:</span> {firstUseCase}
        </p>
      )}

      {variableNames.length > 0 && (
        <p className="mt-1 text-xs text-zinc-500 truncate">
          <span className="text-zinc-600">Variables:</span> {variableNames.join(", ")}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-600">
        {matchedOn ? (
          <span>Matched on: {matchedOn}</span>
        ) : (
          <span />
        )}
        <span>{new Date(prompt.updated_at).toLocaleDateString("en-US")}</span>
      </div>
    </Link>
  );
}
