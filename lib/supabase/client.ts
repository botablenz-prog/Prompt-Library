import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (uses anon key — safe to expose)
// Uses @supabase/ssr so session is stored in cookies, not localStorage,
// allowing the server-side auth client to read the session.
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createSSRBrowserClient(url, key);
}
