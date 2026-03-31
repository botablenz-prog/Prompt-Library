import { NextRequest, NextResponse } from "next/server";
import { interpolate, hasUnfilledVariables } from "@/lib/adaptation/variables";
import { adaptPrompt } from "@/lib/adaptation/llm";
import type { AdaptContext } from "@/lib/types";

// POST /api/adapt
// Body: { promptBody: string, context: AdaptContext }
// Returns: { result: string, usedLLM: boolean }
export async function POST(req: NextRequest) {
  const { promptBody, context } = await req.json() as {
    promptBody: string;
    context: AdaptContext;
  };

  if (!promptBody?.trim()) {
    return NextResponse.json({ error: "promptBody is required" }, { status: 400 });
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
}
