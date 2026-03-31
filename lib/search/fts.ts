import { createServerClient } from "@/lib/supabase/server";

// Returns the set of prompt IDs that match the full-text query
export async function runFTSSearch(query: string, limit = 20): Promise<Set<string>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("prompts")
    .select("id")
    .textSearch("fts", query, { type: "plain", config: "english" })
    .limit(limit);

  if (error) throw new Error(`FTS search failed: ${error.message}`);

  return new Set((data ?? []).map((r: { id: string }) => r.id));
}
