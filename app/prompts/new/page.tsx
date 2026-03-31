import { NewForm } from "./new-form";

export default function NewPromptPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-zinc-100 mb-6">New Prompt</h1>
      <NewForm />
    </div>
  );
}
