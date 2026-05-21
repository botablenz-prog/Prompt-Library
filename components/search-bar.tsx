"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface FacetCount {
  name: string;
  count: number;
}

export interface Facets {
  topics: FacetCount[];
  categories: FacetCount[];
  series: FacetCount[];
}

interface Props {
  defaultValue?: string;
  facets?: Facets;
  filters?: {
    topic?: string;
    category?: string;
    series?: string;
    hasVars?: boolean;
  };
}

function buildUrl(
  query: string,
  filters: { topic?: string; category?: string; series?: string; hasVars?: boolean }
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.category) params.set("category", filters.category);
  if (filters.series) params.set("series", filters.series);
  if (filters.hasVars) params.set("hasVars", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function SearchBar({ defaultValue = "", facets, filters = {} }: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [topic, setTopic] = useState(filters.topic ?? "");
  const [category, setCategory] = useState(filters.category ?? "");
  const [series, setSeries] = useState(filters.series ?? "");
  const [hasVars, setHasVars] = useState(filters.hasVars ?? false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function navigate(overrides: Partial<{ q: string; topic: string; category: string; series: string; hasVars: boolean }> = {}) {
    const next = {
      q: overrides.q ?? query.trim(),
      topic: overrides.topic ?? topic,
      category: overrides.category ?? category,
      series: overrides.series ?? series,
      hasVars: overrides.hasVars ?? hasVars,
    };
    startTransition(() => {
      router.push(buildUrl(next.q, { topic: next.topic, category: next.category, series: next.series, hasVars: next.hasVars }));
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate();
  }

  const selectCls =
    "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none";

  const renderOptions = (items: FacetCount[] | undefined, label: string) => {
    if (!items || items.length === 0) return null;
    return (
      <>
        <option value="">All {label}</option>
        {items.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name} ({f.count})
          </option>
        ))}
      </>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts by meaning or keyword…"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "…" : "Search"}
        </button>
      </div>
      {facets && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <select
            value={topic}
            onChange={(e) => { setTopic(e.target.value); navigate({ topic: e.target.value }); }}
            className={selectCls}
            aria-label="Topic filter"
          >
            {renderOptions(facets.topics, "topics")}
          </select>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); navigate({ category: e.target.value }); }}
            className={selectCls}
            aria-label="Category filter"
          >
            {renderOptions(facets.categories, "categories")}
          </select>
          <select
            value={series}
            onChange={(e) => { setSeries(e.target.value); navigate({ series: e.target.value }); }}
            className={selectCls}
            aria-label="Series filter"
          >
            {renderOptions(facets.series, "series")}
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasVars}
              onChange={(e) => { setHasVars(e.target.checked); navigate({ hasVars: e.target.checked }); }}
              className="rounded border-zinc-700 bg-zinc-900"
            />
            <span>Has variables</span>
          </label>
          {(topic || category || series || hasVars) && (
            <button
              type="button"
              onClick={() => {
                setTopic(""); setCategory(""); setSeries(""); setHasVars(false);
                navigate({ topic: "", category: "", series: "", hasVars: false });
              }}
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
            >
              clear filters
            </button>
          )}
        </div>
      )}
    </form>
  );
}
