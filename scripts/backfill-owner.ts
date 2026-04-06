/**
 * One-time script to backfill user_id on all existing prompts and variants.
 * Run this after set-admin and before using the app post-migration.
 *
 * Usage: npm run backfill-owner -- <admin-user-id>
 *
 * Without this, existing rows have user_id=NULL and cannot be updated or deleted.
 */
import { createClient } from "@supabase/supabase-js";

const adminUserId = process.argv[2];

if (!adminUserId) {
  console.error("Usage: npm run backfill-owner -- <admin-user-id>");
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
  // Backfill prompts
  const { error: promptsError, data: promptsData } = await supabase
    .from("prompts")
    .update({ user_id: adminUserId })
    .is("user_id", null)
    .select("id");

  if (promptsError) {
    console.error("Failed to backfill prompts:", promptsError.message);
    process.exit(1);
  }

  console.log(`✓ Backfilled ${promptsData?.length ?? 0} prompts`);

  // Backfill prompt_variants
  const { error: variantsError, data: variantsData } = await supabase
    .from("prompt_variants")
    .update({ user_id: adminUserId })
    .is("user_id", null)
    .select("id");

  if (variantsError) {
    console.error("Failed to backfill variants:", variantsError.message);
    process.exit(1);
  }

  console.log(`✓ Backfilled ${variantsData?.length ?? 0} variants`);
  console.log("Backfill complete. RLS update/delete policies will now work for existing rows.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
