import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/prompts/[id]/variants
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("prompt_variants")
    .select("id, parent_id, title, frozen_body, adapted_body, context_used, created_at")
    .eq("parent_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/prompts/[id]/variants — save an adapted prompt as a variant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await req.json();

  const { title, adapted_body, context_used } = body;

  if (!adapted_body?.trim()) {
    return NextResponse.json({ error: "adapted_body is required" }, { status: 400 });
  }

  // Fetch parent to get frozen_body snapshot
  const { data: parent, error: parentError } = await supabase
    .from("prompts")
    .select("body")
    .eq("id", id)
    .single();

  if (parentError) {
    return NextResponse.json({ error: parentError.message }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("prompt_variants")
    .insert({
      parent_id: id,
      title: title ?? null,
      frozen_body: parent.body,
      adapted_body,
      context_used: context_used ?? {},
    })
    .select("id, parent_id, title, frozen_body, adapted_body, context_used, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
