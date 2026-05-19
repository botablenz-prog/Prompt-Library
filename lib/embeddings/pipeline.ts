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

// Builds the text fed into the embedding model. Order matters: the most
// discriminating fields (title, topic, series, aliases) come first so the
// model treats them as the primary semantic signal; the long body stays
// last so it doesn't drown them. Title is repeated once — a cheap trick
// to add ~1 token of weight without doubling the body.
//
// Variable names (not full definitions) are included so queries like
// "value proposition" can hit Cold Email — Value Proposition via its
// `value_proposition` variable.
export function buildSearchText(p: {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  tags?: string[] | null;
  category?: string | null;
  topic?: string | null;
  series?: string | null;
  search_aliases?: string[] | null;
  use_cases?: string[] | null;
  notes?: string | null;
  required_variables?: { name: string }[] | null;
  optional_variables?: { name: string }[] | null;
}): string {
  const parts: string[] = [];
  if (p.title)                  parts.push(`Title: ${p.title}`);
  if (p.title)                  parts.push(`Title: ${p.title}`);
  if (p.topic)                  parts.push(`Topic: ${p.topic}`);
  if (p.series)                 parts.push(`Series: ${p.series}`);
  if (p.category)               parts.push(`Category: ${p.category}`);
  if (p.search_aliases?.length) parts.push(`Aliases: ${p.search_aliases.join(", ")}`);
  if (p.tags?.length)           parts.push(`Tags: ${p.tags.join(", ")}`);
  if (p.use_cases?.length)      parts.push(`Use cases:\n${p.use_cases.join("\n")}`);
  if (p.summary)                parts.push(`Summary:\n${p.summary}`);
  const varNames = [
    ...(p.required_variables ?? []),
    ...(p.optional_variables ?? []),
  ].map((v) => v.name).filter(Boolean);
  if (varNames.length)          parts.push(`Variables: ${varNames.join(", ")}`);
  if (p.notes)                  parts.push(`Notes:\n${p.notes}`);
  if (p.body)                   parts.push(`Body:\n${p.body}`);
  return parts.join("\n\n");
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
