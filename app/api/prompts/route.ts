export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings/pipeline";
import type { CreatePromptPayload } from "@/lib/types";

// GET /api/prompts — list all prompts (no embedding column)
export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/prompts — create a new prompt and embed it synchronously
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body: CreatePromptPayload = await req.json();

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  // Generate embedding synchronously so the prompt is searchable immediately
  const embeddingText = [body.title, body.summary, body.body]
    .filter(Boolean)
    .join(" ");
  const embedding = await embed(embeddingText);

  const { data, error } = await supabase
    .from("prompts")
    .insert({ ...body, embedding: JSON.stringify(embedding) })
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
