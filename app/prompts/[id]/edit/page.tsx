import { notFound, redirect } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/anon";
import { getUser, getRole } from "@/lib/auth/session";
import { EditForm } from "./edit-form";
import type { Prompt } from "@/lib/types";

export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (getRole(user) !== "admin") redirect(`/prompts/${id}`);

  const supabase = createAnonClient();
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
