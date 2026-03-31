/**
 * Reindex script — re-embeds ALL prompts (useful after model change)
 * Run: npm run reindex
 */

import { createClient } from "@supabase/supabase-js";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any;

async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    const { pipeline } = await import("@huggingface/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "fp32" });
  }
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

async function main() {
  const { data: prompts, error } = await supabase
    .from("prompts")
    .select("id, title, summary, body");

  if (error) throw error;

  console.log(`Re-indexing ${prompts?.length ?? 0} prompts...\n`);

  for (const p of prompts ?? []) {
    const text = [p.title, p.summary, p.body].filter(Boolean).join(" ");
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

  console.log("\nDone.");
}

main().catch(console.error);
