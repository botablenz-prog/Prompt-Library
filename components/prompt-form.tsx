"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prompt, VariableDef, VariableType } from "@/lib/types";

interface Props {
  initial?: Partial<Prompt>;
  onSave: (data: Partial<Prompt>) => Promise<void>;
  submitLabel?: string;
}

function emptyVar(required: boolean): VariableDef {
  return { name: "", type: "text", required, description: "", options: [] };
}

function VariableEditor({
  vars,
  onChange,
  label,
}: {
  vars: VariableDef[];
  onChange: (v: VariableDef[]) => void;
  label: string;
}) {
  function update(i: number, patch: Partial<VariableDef>) {
    const next = [...vars];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function remove(i: number) {
    onChange(vars.filter((_, idx) => idx !== i));
  }

  const required = vars[0]?.required ?? label === "Required";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-zinc-400">{label} variables</label>
        <button
          type="button"
          onClick={() => onChange([...vars, emptyVar(required)])}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {vars.map((v, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              placeholder="name"
              value={v.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            <select
              value={v.type}
              onChange={(e) => update(i, { type: e.target.value as VariableType })}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
            >
              <option value="text">text</option>
              <option value="long_text">long text</option>
              <option value="choice">choice</option>
            </select>
            <input
              placeholder="description"
              value={v.description ?? ""}
              onChange={(e) => update(i, { description: e.target.value })}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            {v.type === "choice" && (
              <input
                placeholder="opt1, opt2"
                value={(v.options ?? []).join(", ")}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-zinc-600 hover:text-zinc-400 text-xs px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PromptForm({ initial = {}, onSave, submitLabel = "Save" }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial.title ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [tags, setTags] = useState((initial.tags ?? []).join(", "));
  const [useCases, setUseCases] = useState((initial.use_cases ?? []).join("\n"));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [reqVars, setReqVars] = useState<VariableDef[]>(initial.required_variables ?? []);
  const [optVars, setOptVars] = useState<VariableDef[]>(initial.optional_variables ?? []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        summary: summary.trim() || null,
        body: body.trim(),
        category: category.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        use_cases: useCases.split("\n").map((u) => u.trim()).filter(Boolean),
        notes: notes.trim() || null,
        required_variables: reqVars.filter((v) => v.name.trim()),
        optional_variables: optVars.filter((v) => v.name.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div>
        <label className={labelCls}>Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Open Brain Spark"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Summary — one-line job description</label>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Interviews you about your workflow and generates personalized use cases"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Prompt body * (use {"{{variable_name}}"} for placeholders)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={14}
          className={`${inputCls} font-mono resize-y`}
          placeholder="<role>\nYou are a...\n</role>"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Discovery"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. workflow, onboarding, ai"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>When to use / use cases (one per line)</label>
        <textarea
          value={useCases}
          onChange={(e) => setUseCases(e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="After initial setup, when unsure where to start"
        />
      </div>

      <div>
        <label className={labelCls}>Notes (markdown) — what you&apos;ll get, output feeds into, etc.</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className={inputCls}
          placeholder="**What you'll get:** A personalized list of use cases..."
        />
      </div>

      <div className="space-y-4 rounded-md border border-zinc-800 p-4">
        <VariableEditor vars={reqVars} onChange={setReqVars} label="Required" />
        <VariableEditor vars={optVars} onChange={setOptVars} label="Optional" />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
