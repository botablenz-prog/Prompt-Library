export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";
import { embed, buildSearchText } from "@/lib/embeddings/pipeline";
import type { UpdatePromptPayload } from "@/lib/types";

const SELECT_COLS =
  "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at";

// GET /api/prompts/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/prompts/[id] — update prompt; re-embeds if body changed; snapshots version
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase } = guard;

  const { id } = await params;
  const updates: UpdatePromptPayload = await req.json();

  // Fetch current record to snapshot and check if body changed
  const { data: current, error: fetchError } = await supabase
    .from("prompts")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 404 });
  }

  // Snapshot current state before applying update
  await supabase
    .from("prompt_versions")
    .insert({ prompt_id: id, snapshot: current });

  // Re-embed if any searchable field changed
  let embedding: string | undefined;
  const searchableFields = ["title", "summary", "body", "tags", "category", "use_cases", "notes"] as const;
  const searchableChanged = searchableFields.some(
    (f) => updates[f] !== undefined && JSON.stringify(updates[f]) !== JSON.stringify(current[f])
  );

  if (searchableChanged) {
    const vec = await embed(buildSearchText({ ...current, ...updates }));
    embedding = JSON.stringify(vec);
  }

  const payload = embedding ? { ...updates, embedding } : updates;

  const { data, error } = await supabase
    .from("prompts")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/prompts/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase } = guard;

  const { id } = await params;

  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
