"use client";

import { useState } from "react";
import type { Prompt, VariableDef } from "@/lib/types";

type Step = "fill" | "adapting" | "result";

interface Props {
  prompt: Prompt;
  onSaveVariant: (adaptedBody: string, contextUsed: Record<string, string>) => Promise<void>;
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: VariableDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1";
  const inputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";

  return (
    <div>
      <label className={labelCls}>
        {variable.name}
        {variable.required && <span className="text-red-400 ml-0.5">*</span>}
        {variable.description && (
          <span className="text-zinc-600 ml-2 font-normal">{variable.description}</span>
        )}
      </label>
      {variable.type === "choice" && variable.options?.length ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">Select…</option>
          {variable.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : variable.type === "long_text" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`${inputCls} resize-y`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

export function AdaptFlow({ prompt, onSaveVariant }: Props) {
  const allVars = [...prompt.required_variables, ...prompt.optional_variables];
  const hasVars = allVars.length > 0;

  const [step, setStep] = useState<Step>("fill");
  const [values, setValues] = useState<Record<string, string>>({});
  const [freeform, setFreeform] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [usedLLM, setUsedLLM] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setValue(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val }));
  }

  async function handleAdapt() {
    setError(null);
    setStep("adapting");

    try {
      const res = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptBody: prompt.body,
          context: { variables: values, freeform: freeform.trim() || undefined },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Adaptation failed");

      setResult(data.result);
      setUsedLLM(data.usedLLM);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStep("fill");
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveVariant() {
    if (!result) return;
    setSaving(true);
    try {
      await onSaveVariant(result, values);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const missingRequired = prompt.required_variables.filter(
    (v) => !values[v.name]?.trim()
  );

  // ── Fill step ──────────────────────────────────────────────
  if (step === "fill") {
    return (
      <div className="space-y-6">
        {error && (
          <p className="rounded-md bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {hasVars && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">Fill in the variables to adapt this prompt.</p>
            {prompt.required_variables.map((v) => (
              <VariableInput
                key={v.name}
                variable={v}
                value={values[v.name] ?? ""}
                onChange={(val) => setValue(v.name, val)}
              />
            ))}
            {prompt.optional_variables.length > 0 && (
              <details className="group">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                  Optional variables ({prompt.optional_variables.length})
                </summary>
                <div className="mt-3 space-y-4">
                  {prompt.optional_variables.map((v) => (
                    <VariableInput
                      key={v.name}
                      variable={v}
                      value={values[v.name] ?? v.default ?? ""}
                      onChange={(val) => setValue(v.name, val)}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Freeform context — always shown */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            Adapt for my context
            <span className="text-zinc-600 ml-2 font-normal">
              {hasVars ? "Optional — describe anything else about your situation" : "Describe your situation to get a tailored version"}
            </span>
          </label>
          <textarea
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            rows={3}
            placeholder="e.g. I'm a solo founder building a B2B SaaS for HR teams…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAdapt}
            disabled={missingRequired.length > 0}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40 transition-colors"
          >
            {hasVars || freeform.trim() ? "Adapt prompt" : "Use as-is"}
          </button>
          {missingRequired.length > 0 && (
            <p className="self-center text-xs text-zinc-500">
              Fill in: {missingRequired.map((v) => v.name).join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Adapting step ──────────────────────────────────────────
  if (step === "adapting") {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">
        {usedLLM !== undefined ? "Adapting prompt…" : "Processing…"}
      </div>
    );
  }

  // ── Result step ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {usedLLM && (
        <p className="text-xs text-zinc-600">Adapted using LLM</p>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleCopy}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={handleSaveVariant}
          disabled={saving || saved}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saved ? "Saved as variant" : saving ? "Saving…" : "Save as variant"}
        </button>
        <button
          onClick={() => { setStep("fill"); setResult(null); setSaved(false); }}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Start over
        </button>
      </div>

      <pre className="prompt-body rounded-lg border border-zinc-800 bg-zinc-900 p-4 overflow-x-auto">
        {result}
      </pre>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
