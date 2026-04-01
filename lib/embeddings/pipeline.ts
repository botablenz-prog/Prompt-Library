import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// Returns a 384-dimensional embedding vector for the given text.
// Uses text-embedding-3-small with dimensions=384 to match the pgvector column.
export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 384,
  });
  return response.data[0].embedding;
}
