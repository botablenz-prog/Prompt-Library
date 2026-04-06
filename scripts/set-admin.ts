/**
 * One-time script to grant admin role to a user.
 * Usage: npm run set-admin -- <user-id>
 *
 * Run this after creating the admin account in Supabase Dashboard.
 * The user must re-login after this runs to get a fresh JWT with the role.
 */
import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2];

if (!userId) {
  console.error("Usage: npm run set-admin -- <user-id>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" },
  });

  if (error) {
    console.error("Failed to set admin role:", error.message);
    process.exit(1);
  }

  console.log(`✓ Set role=admin for user ${data.user.email} (${userId})`);
  console.log("The user must sign out and back in to get a fresh JWT with the new role.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
