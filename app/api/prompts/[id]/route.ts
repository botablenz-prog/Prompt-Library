export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";
import { embed, buildSearchText } from "@/lib/embeddings/pipeline";
import type { UpdatePromptPayload } from "@/lib/types";

const SELECT_COLS =
  "id, title, summary, body, required_variables, optional_variables, tags, category, topic, series, search_aliases, use_cases, notes, created_at, updated_at";

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
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
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

  if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.length < 1 || updates.title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (updates.body !== undefined && (typeof updates.body !== "string" || updates.body.length < 1 || updates.body.length > 100_000)) {
    return NextResponse.json({ error: "body must be 100,000 characters or fewer" }, { status: 400 });
  }
  if (updates.summary !== undefined && updates.summary !== null && (typeof updates.summary !== "string" || updates.summary.length > 5_000)) {
    return NextResponse.json({ error: "summary must be 5,000 characters or fewer" }, { status: 400 });
  }
  if (updates.notes !== undefined && updates.notes !== null && (typeof updates.notes !== "string" || updates.notes.length > 5_000)) {
    return NextResponse.json({ error: "notes must be 5,000 characters or fewer" }, { status: 400 });
  }
  if (updates.tags !== undefined && (!Array.isArray(updates.tags) || updates.tags.length > 20 || updates.tags.some((t) => typeof t !== "string" || t.length > 50))) {
    return NextResponse.json({ error: "tags must be an array of up to 20 strings (max 50 chars each)" }, { status: 400 });
  }
  if (updates.topic !== undefined && updates.topic !== null && (typeof updates.topic !== "string" || updates.topic.length > 100)) {
    return NextResponse.json({ error: "topic must be 100 characters or fewer" }, { status: 400 });
  }
  if (updates.series !== undefined && updates.series !== null && (typeof updates.series !== "string" || updates.series.length > 100)) {
    return NextResponse.json({ error: "series must be 100 characters or fewer" }, { status: 400 });
  }
  if (updates.search_aliases !== undefined && (!Array.isArray(updates.search_aliases) || updates.search_aliases.length > 20 || updates.search_aliases.some((a) => typeof a !== "string" || a.length > 100))) {
    return NextResponse.json({ error: "search_aliases must be an array of up to 20 strings (max 100 chars each)" }, { status: 400 });
  }

  // Fetch current record to snapshot and check if body changed
  const { data: current, error: fetchError } = await supabase
    .from("prompts")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  // Snapshot current state before applying update
  await supabase
    .from("prompt_versions")
    .insert({ prompt_id: id, snapshot: current });

  // Re-embed if any searchable field changed
  let embedding: string | undefined;
  const searchableFields = ["title", "summary", "body", "tags", "category", "topic", "series", "search_aliases", "use_cases", "notes"] as const;
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
    console.error("[PATCH /api/prompts/[id]]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
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
    console.error("[DELETE /api/prompts/[id]]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
