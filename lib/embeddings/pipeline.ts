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

// Returns a 384-dimensional embedding vector for the given text.
// Uses text-embedding-3-small with dimensions=384 to match the pgvector column.
export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: "openai/text-embedding-3-small",
    input: text,
    dimensions: 384,
  });
  return response.data[0].embedding;
}
