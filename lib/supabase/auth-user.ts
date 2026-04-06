import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-aware client that passes the user's JWT to Supabase.
// RLS policies are enforced using auth.uid() from the user's session.
// Use this for authenticated write operations in API routes and server components.
export async function createAuthUserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll may be called from a Server Component where cookies are read-only.
          // The middleware handles session refresh so this is safe to ignore.
        }
      },
    },
  });
}
