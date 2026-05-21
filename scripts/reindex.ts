/**
 * Reindex script — re-embeds ALL prompts (useful after model change)
 * Run: npm run reindex
 */

import { createClient } from "@supabase/supabase-js";
import { embed, buildSearchText } from "../lib/embeddings/pipeline";

function loadEnv() {
  try {
    const content = require("fs").readFileSync(".env.local", "utf8");
    for (const line of content.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && !key.startsWith("#") && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch { /* no .env.local */ }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: prompts, error } = await supabase
    .from("prompts")
    .select("id, title, summary, body, tags, category, topic, series, search_aliases, use_cases, notes, required_variables, optional_variables");

  if (error) throw error;

  console.log("========================================");
  console.log("BEFORE REINDEX — run this in Supabase SQL Editor to preserve updated_at:");
  console.log("  ALTER TABLE prompts DISABLE TRIGGER prompts_updated_at;");
  console.log("========================================\n");

  console.log(`Re-indexing ${prompts?.length ?? 0} prompts...\n`);

  for (const p of prompts ?? []) {
    const text = buildSearchText(p);
    const embedding = await embed(text);

    const { error: updateError } = await supabase
      .from("prompts")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", p.id);

    if (updateError) {
      console.error(`✗ ${p.title}:`, updateError.message);
    } else {
      console.log(`✓ ${p.title}`);
    }
  }

  console.log("\n========================================");
  console.log("AFTER REINDEX — run this in Supabase SQL Editor to re-enable timestamps:");
  console.log("  ALTER TABLE prompts ENABLE TRIGGER prompts_updated_at;");
  console.log("========================================");
  console.log("\nDone.");
}

main().catch(console.error);
