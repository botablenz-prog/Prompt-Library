import { createAuthUserClient } from "@/lib/supabase/auth-user";
import type { User } from "@supabase/supabase-js";
import type { AuthState, Role } from "./types";

// Validates the session JWT against Supabase (more secure than getSession()).
export async function getUser(): Promise<User | null> {
  const supabase = await createAuthUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export function getRole(user: User | null): Role {
  if (user?.app_metadata?.role === "admin") return "admin";
  return "guest";
}

export function getAuthState(user: User | null): AuthState {
  return {
    isLoggedIn: user !== null,
    role: getRole(user),
    email: user?.email ?? null,
  };
}
