import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guard";
import { interpolate, hasUnfilledVariables } from "@/lib/adaptation/variables";
import { adaptPrompt } from "@/lib/adaptation/llm";
import type { AdaptContext } from "@/lib/types";

// POST /api/adapt
// Body: { promptBody: string, context: AdaptContext }
// Returns: { result: string, usedLLM: boolean }
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { promptBody, context } = body as { promptBody: string; context: AdaptContext };

    if (!promptBody?.trim()) {
      return NextResponse.json({ error: "promptBody is required" }, { status: 400 });
    }
    if (typeof promptBody !== "string" || promptBody.length > 50_000) {
      return NextResponse.json({ error: "promptBody must be 50,000 characters or fewer" }, { status: 400 });
    }
    if (context?.freeform && (typeof context.freeform !== "string" || context.freeform.length > 10_000)) {
      return NextResponse.json({ error: "freeform context must be 10,000 characters or fewer" }, { status: 400 });
    }

    const ctx = context ?? { variables: {} };

    // Step 1: interpolate known variables
    const interpolated = interpolate(promptBody, ctx.variables ?? {});

    // Step 2: if no unfilled vars and no freeform context → return as-is (no LLM)
    const needsLLM = hasUnfilledVariables(interpolated) || !!ctx.freeform?.trim();

    if (!needsLLM) {
      return NextResponse.json({ result: interpolated, usedLLM: false });
    }

    // Step 3: call LLM to fill gaps or adapt for freeform context
    const result = await adaptPrompt(interpolated, ctx);
    return NextResponse.json({ result, usedLLM: true });
  } catch (err: unknown) {
    const e = err as { code?: string; name?: string; message?: string };
    console.error("[POST /api/adapt]", e?.code ?? e?.name ?? e?.message ?? "unknown");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
