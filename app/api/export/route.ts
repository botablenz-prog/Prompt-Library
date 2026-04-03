export const runtime = "nodejs";

import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Reorder fields for human readability — embedding intentionally excluded
  const ordered = (data ?? []).map((p) => ({
    title: p.title,
    summary: p.summary,
    category: p.category,
    tags: p.tags,
    use_cases: p.use_cases,
    body: p.body,
    notes: p.notes,
    required_variables: p.required_variables,
    optional_variables: p.optional_variables,
    id: p.id,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const date = new Date().toISOString().slice(0, 10);
  const filename = `prompt-library-export-${date}.json`;

  return new Response(JSON.stringify(ordered, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
