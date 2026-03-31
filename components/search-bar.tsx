"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  defaultValue?: string;
}

export function SearchBar({ defaultValue = "" }: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    startTransition(() => {
      router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
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
    </form>
  );
}
