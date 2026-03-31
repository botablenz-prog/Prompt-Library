import OpenAI from "openai";
import type { AdaptContext } from "@/lib/types";

// OpenRouter uses the OpenAI SDK with a custom baseURL
function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://prompt-library.local",
      "X-Title": "Prompt Library",
    },
  });
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";
}

// Adapt a prompt body using the provided context.
// Called only when:
//  (a) variables remain unfilled after interpolation, or
//  (b) user explicitly requests "Adapt for my context" (Path B)
export async function adaptPrompt(
  promptBody: string,
  context: AdaptContext
): Promise<string> {
  const client = getClient();

  const filledVars = Object.entries(context.variables)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const systemPrompt = `You are a prompt engineering assistant. Your job is to adapt a saved prompt template for a specific use case.

Rules:
- Return ONLY the adapted prompt text. No explanation, no preamble.
- Preserve the original prompt's structure, tone, and intent.
- Replace any remaining {{variable}} placeholders with appropriate content based on the context provided.
- If freeform context is provided, weave it naturally into the prompt.
- Do not add new features or change the prompt's purpose.`;

  const userMessage = [
    "Adapt the following prompt for my specific use case.",
    "",
    filledVars ? `Filled variables:\n${filledVars}` : "",
    context.freeform ? `My context: ${context.freeform}` : "",
    "",
    "Prompt to adapt:",
    "---",
    promptBody,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() ?? promptBody;
}
