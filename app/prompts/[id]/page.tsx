import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import type { Prompt, PromptVariant } from "@/lib/types";
import { DeleteButton } from "./delete-button";

async function getPrompt(id: string): Promise<Prompt | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Prompt;
}

async function getVariants(promptId: string): Promise<PromptVariant[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("prompt_variants")
    .select("id, parent_id, title, frozen_body, adapted_body, context_used, created_at")
    .eq("parent_id", promptId)
    .order("created_at", { ascending: false });

  return (data ?? []) as PromptVariant[];
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prompt, variants] = await Promise.all([
    getPrompt(id),
    getVariants(id),
  ]);

  if (!prompt) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{prompt.title}</h1>
          {prompt.summary && (
            <p className="mt-1 text-sm text-zinc-400">{prompt.summary}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/prompts/${prompt.id}/use`}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white transition-colors"
          >
            Use prompt
          </Link>
          <Link
            href={`/prompts/${prompt.id}/edit`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Edit
          </Link>
          <DeleteButton id={prompt.id} />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        {prompt.category && (
          <span className="rounded px-2 py-1 text-xs bg-zinc-800 text-zinc-400">
            {prompt.category}
          </span>
        )}
        {prompt.tags.map((tag) => (
          <span key={tag} className="rounded px-2 py-1 text-xs bg-zinc-800 text-zinc-500">
            {tag}
          </span>
        ))}
      </div>

      {/* Use cases */}
      {prompt.use_cases.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            When to use
          </h2>
          <ul className="space-y-1">
            {prompt.use_cases.map((uc, i) => (
              <li key={i} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-zinc-600">—</span> {uc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {prompt.notes && (
        <div>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Notes
          </h2>
          <p className="text-sm text-zinc-400 whitespace-pre-wrap">{prompt.notes}</p>
        </div>
      )}

      {/* Variables */}
      {(prompt.required_variables.length > 0 || prompt.optional_variables.length > 0) && (
        <div>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Variables
          </h2>
          <div className="space-y-1">
            {prompt.required_variables.map((v) => (
              <div key={v.name} className="flex gap-2 text-sm">
                <code className="text-zinc-300 font-mono text-xs">{`{{${v.name}}}`}</code>
                <span className="text-zinc-600 text-xs">required · {v.type}</span>
                {v.description && <span className="text-zinc-500 text-xs">{v.description}</span>}
              </div>
            ))}
            {prompt.optional_variables.map((v) => (
              <div key={v.name} className="flex gap-2 text-sm">
                <code className="text-zinc-400 font-mono text-xs">{`{{${v.name}}}`}</code>
                <span className="text-zinc-700 text-xs">optional · {v.type}</span>
                {v.description && <span className="text-zinc-600 text-xs">{v.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt body */}
      <div>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Prompt
        </h2>
        <pre className="prompt-body rounded-lg border border-zinc-800 bg-zinc-900 p-4 overflow-x-auto text-zinc-300">
          {prompt.body}
        </pre>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Saved variants ({variants.length})
          </h2>
          <div className="space-y-3">
            {variants.map((v) => (
              <details key={v.id} className="rounded-lg border border-zinc-800 group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">
                  <span>{v.title ?? `Variant — ${new Date(v.created_at).toLocaleDateString()}`}</span>
                  <span className="text-xs text-zinc-600">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                </summary>
                <div className="px-4 pb-4">
                  <pre className="prompt-body text-zinc-400 whitespace-pre-wrap">
                    {v.adapted_body}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-700">
        Created {new Date(prompt.created_at).toLocaleString()} · Updated{" "}
        {new Date(prompt.updated_at).toLocaleString()}
      </p>
    </div>
  );
}
