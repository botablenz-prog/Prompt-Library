import { createAuthUserClient } from "@/lib/supabase/auth-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type GuardSuccess = { supabase: SupabaseClient; userId: string };

// Call at the top of every write/paid API route.
// Returns the authenticated Supabase client + userId on success,
// or a 401 NextResponse that the route handler must return immediately.
export async function requireAdmin(): Promise<GuardSuccess | NextResponse> {
  const supabase = await createAuthUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { supabase, userId: user.id };
}
