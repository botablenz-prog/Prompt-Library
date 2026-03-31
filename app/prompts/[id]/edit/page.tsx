import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { EditForm } from "./edit-form";
import type { Prompt } from "@/lib/types";

export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id, title, summary, body, required_variables, optional_variables, tags, category, use_cases, notes, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-zinc-100 mb-6">Edit Prompt</h1>
      <EditForm prompt={data as Prompt} />
    </div>
  );
}
