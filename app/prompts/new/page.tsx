import { redirect } from "next/navigation";
import { getUser, getRole } from "@/lib/auth/session";
import { NewForm } from "./new-form";

export default async function NewPromptPage() {
  const user = await getUser();
  if (getRole(user) !== "admin") redirect("/");

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-zinc-100 mb-6">New Prompt</h1>
      <NewForm />
    </div>
  );
}
