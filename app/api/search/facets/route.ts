export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getFacets } from "@/lib/search/facets";

// Counts of distinct topic / category / series values across all prompts.
// Used to populate the search filter dropdowns. Read-only; anon access.
export async function GET() {
  try {
    const facets = await getFacets();
    return NextResponse.json(facets);
  } catch (err) {
    const e = err as { code?: string; name?: string };
    console.error("[GET /api/search/facets]", e?.code ?? e?.name ?? "unknown");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
