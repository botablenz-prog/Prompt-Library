export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";
import { embed, buildSearchText } from "@/lib/embeddings/pipeline";
import type { CreatePromptPayload } from "@/lib/types";

// GET /api/prompts — paginated prompt list (no embedding column)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[GET /api/prompts]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/prompts — create a new prompt and embed it synchronously
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase, userId } = guard;

  const body: CreatePromptPayload = await req.json();

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || body.title.length > 255) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (typeof body.body !== "string" || body.body.length > 100_000) {
    return NextResponse.json({ error: "body must be 100,000 characters or fewer" }, { status: 400 });
  }
  if (body.summary && (typeof body.summary !== "string" || body.summary.length > 5_000)) {
    return NextResponse.json({ error: "summary must be 5,000 characters or fewer" }, { status: 400 });
  }
  if (body.notes && (typeof body.notes !== "string" || body.notes.length > 5_000)) {
    return NextResponse.json({ error: "notes must be 5,000 characters or fewer" }, { status: 400 });
  }
  if (body.tags && (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((t) => typeof t !== "string" || t.length > 50))) {
    return NextResponse.json({ error: "tags must be an array of up to 20 strings (max 50 chars each)" }, { status: 400 });
  }

  // Generate embedding synchronously so the prompt is searchable immediately
  const embedding = await embed(buildSearchText(body));

  const { data, error } = await supabase
    .from("prompts")
    .insert({ ...body, user_id: userId, embedding: JSON.stringify(embedding) })
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("[POST /api/prompts]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
