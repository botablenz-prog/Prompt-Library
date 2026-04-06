"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { AuthState } from "@/lib/auth/types";

export function Nav({ auth }: { auth: AuthState }) {
  const router = useRouter();
  const isAdmin = auth.role === "admin";

  async function signOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="mx-auto max-w-4xl flex items-center justify-between">
        <a
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-100 hover:text-white"
        >
          Prompt Library
        </a>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <a
                href="/api/export"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              >
                ↓ Export JSON
              </a>
              <a
                href="/prompts/new"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                + New Prompt
              </a>
            </>
          )}

          {auth.isLoggedIn ? (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-zinc-500">{auth.email}</span>
              <button
                onClick={signOut}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="ml-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
