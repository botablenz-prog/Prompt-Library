"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prompt } from "@/lib/types";

export function EditForm({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const [title, setTitle] = useState(prompt.title);
  const [summary, setSummary] = useState(prompt.summary ?? "");
  const [body, setBody] = useState(prompt.body);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMeta, setAutoMeta] = useState<null | {
    summary: string | null;
    tags: string[];
    category: string;
    use_cases: string[];
    notes: string;
    required_variables: { name: string; type: string; required: boolean }[];
    optional_variables: { name: string; type: string; required: boolean }[];
  }>(null);

  async function handleAutoFill() {
    if (!body.trim()) return;
    setFilling(true);
    try {
      const res = await fetch("/api/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: summary, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Auto-fill failed");
      setAutoMeta(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-fill failed");
    } finally {
      setFilling(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        summary: summary.trim() || null,
        body: body.trim(),
      };
      // Only update metadata fields if auto-fill was run
      if (autoMeta) {
        payload.summary = autoMeta.summary ?? (summary.trim() || null);
        payload.tags = autoMeta.tags;
        payload.category = autoMeta.category;
        payload.use_cases = autoMeta.use_cases;
        payload.notes = autoMeta.notes ?? (summary.trim() || null);
        payload.required_variables = autoMeta.required_variables;
        payload.optional_variables = autoMeta.optional_variables;
      }

      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update prompt");
      }

      router.push(`/prompts/${prompt.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Description
          <span className="text-zinc-600 ml-2 font-normal">any notes about what it does, when to use it, etc.</span>
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          className={`${inputCls} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Prompt body *
          <span className="text-zinc-600 ml-2 font-normal">use {`{{variable_name}}`} for placeholders</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={14}
          className={`${inputCls} font-mono resize-y`}
        />
      </div>

      {autoMeta && (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 space-y-1 text-xs text-zinc-400">
          <p className="text-zinc-300 font-medium mb-2">Auto-filled metadata</p>
          {autoMeta.summary && <p><span className="text-zinc-600">Summary:</span> {autoMeta.summary}</p>}
          {autoMeta.category && <p><span className="text-zinc-600">Category:</span> {autoMeta.category}</p>}
          {autoMeta.tags.length > 0 && <p><span className="text-zinc-600">Tags:</span> {autoMeta.tags.join(", ")}</p>}
          {autoMeta.use_cases.length > 0 && (
            <p><span className="text-zinc-600">Use cases:</span> {autoMeta.use_cases.join(" · ")}</p>
          )}
          {autoMeta.required_variables.length > 0 && (
            <p><span className="text-zinc-600">Variables detected:</span> {autoMeta.required_variables.map((v: { name: string }) => `{{${v.name}}}`).join(", ")}</p>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleAutoFill}
          disabled={filling || !body.trim()}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
        >
          {filling ? "Filling…" : autoMeta ? "Re-fill metadata" : "Auto-fill metadata"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
