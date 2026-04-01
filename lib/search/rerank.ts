import OpenAI from "openai";
import type { Prompt } from "@/lib/types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://prompt-library.local",
        "X-Title": "Prompt Library",
      },
    });
  }
  return client;
}

// Returns candidate IDs sorted by relevance to the query, most relevant first.
// Falls back to original order if the LLM call fails or returns invalid JSON.
export async function rerankResults(
  query: string,
  candidates: Prompt[]
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const originalOrder = candidates.map((c) => c.id);

  try {
    const list = candidates
      .map((c, i) => {
        const context = c.summary ?? c.body?.slice(0, 200) ?? "";
        const meta = [
          c.category,
          c.tags?.join(", "),
          c.use_cases?.join(", "),
        ]
          .filter(Boolean)
          .join(" | ");
        return `${i + 1}. [${c.id}] ${c.title}${context ? ` — ${context}` : ""}${meta ? ` (${meta})` : ""}`;
      })
      .join("\n");

    const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";

    const response = await getClient().chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a search relevance ranker. Given a search query and a list of prompts, return ONLY a JSON array of IDs sorted from most to least relevant. Include all IDs. Return nothing else.",
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nCandidates:\n${list}\n\nReturn a JSON array of the IDs in relevance order.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
    const ranked: string[] = JSON.parse(raw);

    // Append any IDs the LLM omitted
    const seen = new Set(ranked);
    for (const id of originalOrder) {
      if (!seen.has(id)) ranked.push(id);
    }

    return ranked;
  } catch {
    return originalOrder;
  }
}
