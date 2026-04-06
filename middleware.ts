import { NextResponse, type NextRequest } from "next/server";
import { createAuthMiddlewareClient } from "@/lib/supabase/auth-middleware";

// Refreshes the Supabase session cookie on every request so it does not
// expire silently during active use. Does not block or redirect — route-level
// guards and RLS policies handle authorization.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createAuthMiddlewareClient(request, response);
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
