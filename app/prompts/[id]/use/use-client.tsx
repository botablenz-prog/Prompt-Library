"use client";

import { AdaptFlow } from "@/components/adapt-flow";
import type { Prompt } from "@/lib/types";

export function UseClient({ prompt }: { prompt: Prompt }) {
  async function saveVariant(adaptedBody: string, contextUsed: Record<string, string>) {
    const res = await fetch(`/api/prompts/${prompt.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapted_body: adaptedBody, context_used: contextUsed }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to save variant");
    }
  }

  return <AdaptFlow prompt={prompt} onSaveVariant={saveVariant} />;
}
