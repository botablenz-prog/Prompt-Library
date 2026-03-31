import { createServerClient } from "@/lib/supabase/server";

export interface VectorResult {
  id: string;
  vec_score: number;
}

// Returns top-N prompts by cosine similarity to queryVec
export async function runVectorSearch(
  queryVec: number[],
  limit = 20
): Promise<VectorResult[]> {
  const supabase = createServerClient();
  const vecString = `[${queryVec.join(",")}]`;

  const { data, error } = await supabase
    .rpc("search_by_embedding", { query_embedding: vecString, match_count: limit });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  return (data ?? []) as VectorResult[];
}
