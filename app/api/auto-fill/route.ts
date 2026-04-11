import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/auth/api-guard";
import { extractVariableNames } from "@/lib/adaptation/variables";

// POST /api/auto-fill
// Body: { title: string, body: string }
// Returns: { tags, category, use_cases, notes, required_variables, optional_variables }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { title, description, body } = await req.json();

  if (!body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (typeof body !== "string" || body.length > 50_000) {
    return NextResponse.json({ error: "body must be 50,000 characters or fewer" }, { status: 400 });
  }
  if (title !== undefined && title !== null && (typeof title !== "string" || title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 5_000)) {
    return NextResponse.json({ error: "description must be 5,000 characters or fewer" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://prompt-library.local",
      "X-Title": "Prompt Library",
    },
  });

  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";

  // Detect {{variable}} placeholders from the body
  const varNames = extractVariableNames(body);

  const systemPrompt = `You are a prompt librarian. Given a prompt title, optional description, and body, output a JSON object with metadata.

Output ONLY a raw JSON object — no markdown fences, no explanation, nothing else. Use this exact shape:
{"summary":"one concise sentence max 15 words capturing what this prompt does","category":"one of: Discovery, Productivity, Engineering, Sales, Writing, Research, Strategy, Other","tags":["2-5","lowercase","keyword","tags"],"use_cases":["1-3 sentences on when to use this prompt"],"notes":"markdown with **What you'll get:** and **Output feeds into:** sections"}`;

  const userMessage = `Title: ${title || "(untitled)"}${description?.trim() ? `\n\nDescription: ${description.trim()}` : ""}

Prompt body:
${body}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let meta: {
      summary?: string;
      category?: string;
      tags?: string[];
      use_cases?: string[];
      notes?: string;
    };

    try {
      // Strip markdown code fences if the model wraps output anyway
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      meta = JSON.parse(cleaned);
    } catch {
      meta = {};
    }

    // Build variable definitions from detected {{variable}} names
    const required_variables = varNames.map((name) => ({
      name,
      type: "text" as const,
      required: true,
      description: "",
    }));

    return NextResponse.json({
      summary: meta.summary ?? null,
      category: meta.category ?? null,
      tags: meta.tags ?? [],
      use_cases: meta.use_cases ?? [],
      notes: meta.notes ?? null,
      required_variables,
      optional_variables: [],
    });
  } catch (err: unknown) {
    const e = err as { code?: string; name?: string };
    console.error("[POST /api/auto-fill]", e?.code ?? e?.name ?? "unknown");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
