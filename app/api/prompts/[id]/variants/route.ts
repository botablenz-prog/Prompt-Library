import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/auth/api-guard";

// GET /api/prompts/[id]/variants
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("prompt_variants")
    .select("id, parent_id, title, frozen_body, adapted_body, created_at")
    .eq("parent_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/prompts/[id]/variants]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/prompts/[id]/variants — save an adapted prompt as a variant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase, userId } = guard;

  const { id } = await params;
  const body = await req.json();

  const { title, adapted_body, context_used } = body;

  if (!adapted_body?.trim()) {
    return NextResponse.json({ error: "adapted_body is required" }, { status: 400 });
  }
  if (typeof adapted_body !== "string" || adapted_body.length > 100_000) {
    return NextResponse.json({ error: "adapted_body must be 100,000 characters or fewer" }, { status: 400 });
  }
  if (title !== undefined && title !== null && (typeof title !== "string" || title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }

  // Fetch parent to get frozen_body snapshot
  const { data: parent, error: parentError } = await supabase
    .from("prompts")
    .select("body")
    .eq("id", id)
    .single();

  if (parentError) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("prompt_variants")
    .insert({
      parent_id: id,
      user_id: userId,
      title: title ?? null,
      frozen_body: parent.body,
      adapted_body,
      context_used: context_used ?? {},
    })
    .select("id, parent_id, title, frozen_body, adapted_body, created_at")
    .single();

  if (error) {
    console.error("[POST /api/prompts/[id]/variants]", error.code ?? error.name);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
