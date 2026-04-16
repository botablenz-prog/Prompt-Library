import OpenAI from "openai";

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

export function buildSearchText(p: {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  tags?: string[] | null;
  category?: string | null;
  use_cases?: string[] | null;
  notes?: string | null;
}): string {
  const parts: string[] = [];
  if (p.title)             parts.push(`Title: ${p.title}`);
  if (p.summary)           parts.push(`Summary: ${p.summary}`);
  if (p.category)          parts.push(`Category: ${p.category}`);
  if (p.tags?.length)      parts.push(`Tags: ${p.tags.join(", ")}`);
  if (p.use_cases?.length) parts.push(`Use cases: ${p.use_cases.join(", ")}`);
  if (p.body)              parts.push(`Body: ${p.body}`);
  if (p.notes)             parts.push(`Notes: ${p.notes}`);
  return parts.join("\n");
}

export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: "openai/text-embedding-3-small",
    input: text,
    dimensions: 384,
  });
  const vec = response.data?.[0]?.embedding;
  if (!vec) throw new Error("Empty embedding response");
  return vec;
}
