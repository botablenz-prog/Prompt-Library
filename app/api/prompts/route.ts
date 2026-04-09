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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
