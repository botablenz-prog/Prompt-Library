import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { UseClient } from "./use-client";
import type { Prompt } from "@/lib/types";

export default async function UsePromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const prompt = data as Prompt;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/prompts/${prompt.id}`}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          ← {prompt.title}
        </Link>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Use Prompt</h1>
        {prompt.summary && (
          <p className="mt-1 text-sm text-zinc-400">{prompt.summary}</p>
        )}
      </div>

      <UseClient prompt={prompt} />
    </div>
  );
}
