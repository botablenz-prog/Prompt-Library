"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prompt, VariableDef, VariableType } from "@/lib/types";
import { mergeAutoFill, hasAnyBlankField, type AutoFillFields } from "@/lib/auto-fill-merge";

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
  const isNew = !initial.id;

  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [title, setTitle] = useState(initial.title ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [topic, setTopic] = useState(initial.topic ?? "");
  const [series, setSeries] = useState(initial.series ?? "");
  const [tags, setTags] = useState((initial.tags ?? []).join(", "));
  const [aliases, setAliases] = useState((initial.search_aliases ?? []).join(", "));
  const [useCases, setUseCases] = useState((initial.use_cases ?? []).join("\n"));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [reqVars, setReqVars] = useState<VariableDef[]>(initial.required_variables ?? []);
  const [optVars, setOptVars] = useState<VariableDef[]>(initial.optional_variables ?? []);

  // Count of metadata fields with non-blank user content — shown in the
  // collapsed section header so you can tell at a glance how much is set
  // without expanding.
  const fieldsSetCount = [category, topic, series, tags, aliases, useCases, notes]
    .filter((v) => v.trim().length > 0).length
    + (reqVars.filter((v) => v.name.trim()).length > 0 ? 1 : 0)
    + (optVars.filter((v) => v.name.trim()).length > 0 ? 1 : 0);

  function collectUserFields(): AutoFillFields {
    return {
      title:           title.trim() || null,
      summary:         summary.trim() || null,
      category:        category.trim() || null,
      topic:           topic.trim() || null,
      series:          series.trim() || null,
      tags:            tags.split(",").map((t) => t.trim()).filter(Boolean),
      search_aliases:  aliases.split(",").map((a) => a.trim()).filter(Boolean),
      use_cases:       useCases.split("\n").map((u) => u.trim()).filter(Boolean),
      notes:           notes.trim() || null,
      required_variables: reqVars.filter((v) => v.name.trim()),
      optional_variables: optVars.filter((v) => v.name.trim()),
    };
  }

  async function callAutoFill(): Promise<AutoFillFields | null> {
    try {
      const res = await fetch("/api/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: summary, body }),
      });
      if (!res.ok) return null;
      return (await res.json()) as AutoFillFields;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSaving(true);

    if (!body.trim()) {
      setError("Body is required.");
      setSaving(false);
      return;
    }

    let merged = collectUserFields();

    // Auto-fill only on new prompts where at least one metadata field is blank.
    if (isNew && hasAnyBlankField(merged)) {
      setAutoFilling(true);
      const llm = await callAutoFill();
      setAutoFilling(false);
      if (llm) {
        merged = mergeAutoFill(merged, llm);
      } else {
        setWarning("Auto-fill failed — saving with the fields you typed.");
      }
    }

    // Title is required at the DB layer. If user didn't type one AND auto-fill
    // didn't fill it (e.g. failed or returned empty), block with a clear message.
    if (!merged.title || !merged.title.trim()) {
      setError("Title is required. Auto-fill couldn't generate one — please type a title.");
      setSaving(false);
      return;
    }

    try {
      await onSave({
        title: merged.title,
        summary: merged.summary,
        body: body.trim(),
        category: merged.category,
        topic: merged.topic,
        series: merged.series,
        tags: merged.tags,
        search_aliases: merged.search_aliases,
        use_cases: merged.use_cases,
        notes: merged.notes,
        required_variables: merged.required_variables,
        optional_variables: merged.optional_variables,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";
  const smallInputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1";

  const buttonText = autoFilling ? "Filling blanks…" : saving ? "Saving…" : submitLabel;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {warning && (
        <p className="rounded-md bg-amber-950 border border-amber-800 px-4 py-3 text-sm text-amber-300">
          {warning}
        </p>
      )}

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

      <div>
        <label className={labelCls}>Title {isNew && <span className="text-zinc-600">(optional — auto-fills on save)</span>}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Open Brain Spark"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Summary {isNew && <span className="text-zinc-600">(optional — auto-fills on save)</span>}</label>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Interviews you about your workflow and generates personalized use cases"
          className={inputCls}
        />
      </div>

      <details
        open={expanded}
        onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
        className="rounded-md border border-zinc-800"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 select-none">
          Retrieval metadata
          <span className="ml-2 text-xs text-zinc-500">optional, auto-generated</span>
          {!expanded && fieldsSetCount > 0 && (
            <span className="ml-2 text-xs text-zinc-400">· {fieldsSetCount} field{fieldsSetCount === 1 ? "" : "s"} set</span>
          )}
        </summary>
        <div className="space-y-4 p-4 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. AI Agents"
                className={smallInputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Series</label>
              <input
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="e.g. Deployment"
                className={smallInputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Engineering"
                className={smallInputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. workflow, onboarding, ai"
              className={smallInputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Search aliases (comma-separated — short phrases you&apos;d type to find this)</label>
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. claude md, rules file, agents.md"
              className={smallInputCls}
            />
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

          <div className="space-y-4 rounded-md border border-zinc-800 p-3">
            <VariableEditor vars={reqVars} onChange={setReqVars} label="Required" />
            <VariableEditor vars={optVars} onChange={setOptVars} label="Optional" />
          </div>
        </div>
      </details>

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={saving || autoFilling}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
        >
          {buttonText}
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
