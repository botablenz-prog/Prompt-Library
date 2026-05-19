/**
 * Backfill retrieval metadata (topic, series, search_aliases) on existing prompts.
 *
 * Usage:
 *   npm run backfill:retrieval                       # dry-run (default) — prints table, no writes
 *   npm run backfill:retrieval -- --apply           # writes blanks only (preserves non-empty)
 *   npm run backfill:retrieval -- --apply --overwrite  # also overwrites non-empty fields
 *
 * IMPORTANT: --apply writes via supabase-js, which fires the `prompts_updated_at`
 * trigger and bumps updated_at on every row. To preserve timestamps, run this SQL
 * in the Supabase SQL Editor BEFORE --apply:
 *
 *   ALTER TABLE prompts DISABLE TRIGGER prompts_updated_at;
 *
 * Then re-enable AFTER:
 *
 *   ALTER TABLE prompts ENABLE TRIGGER prompts_updated_at;
 *
 * The script will print these reminders when invoked with --apply.
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface PromptRow {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  use_cases: string[];
  topic: string | null;
  series: string | null;
  search_aliases: string[];
}

interface Proposal {
  id: string;
  title: string;
  currentTopic: string | null;
  currentSeries: string | null;
  currentAliases: string[];
  proposedTopic: string | null;
  proposedSeries: string | null;
  proposedAliases: string[];
  reviewFlags: string[];
}

// ─── Series detection ─────────────────────────────────────────────────────
//
// Only assign a series when ≥2 prompts share the prefix AND the user has
// explicitly named it as a workflow family. Single-prompt prefixes (e.g.
// "Hardware - ") stay null.

const SERIES_PATTERNS: { regex: RegExp; series: string }[] = [
  { regex: /^Deployment - /,           series: "Deployment" },
  { regex: /^AI Deployment - /,        series: "AI Deployment" },        // flag for review — possibly merge into "Deployment"
  { regex: /^Intent - /,               series: "Intent" },
  { regex: /^Skill - /,                series: "Skill" },
  { regex: /^Claude Dispatch - /,      series: "Claude Dispatch" },
  { regex: /^AI Wiki - /,              series: "AI Wiki" },
  { regex: /^Codex Plugin - /,         series: "Codex Plugin" },
  { regex: /^Memory Layer - /,         series: "Memory Layer" },
  { regex: /^AI for [Kk]ids - /,       series: "AI for Kids" },
  { regex: /^(AI )?Vibe Coding - /,    series: "Vibe Coding" },
  { regex: /^Plugin - /,               series: "Plugin" },                // flag for review — possibly merge into "Codex Plugin"
];

function detectSeries(title: string): string | null {
  for (const { regex, series } of SERIES_PATTERNS) {
    if (regex.test(title)) return series;
  }
  return null;
}

// ─── Topic detection ─────────────────────────────────────────────────────
//
// Topic > series in importance. Map series first (highest signal), then
// fall back to tag-based heuristics. Conservative — better to leave null
// than mis-tag.

const SERIES_TO_TOPIC: Record<string, string> = {
  "Deployment":      "AI Agents",
  "AI Deployment":   "AI Tools",          // they're "AI Tool measurement" prompts, not agent-deployment
  "Intent":          "AI Safety",
  "Skill":           "AI Workflow",
  "Claude Dispatch": "AI Agents",
  "AI Wiki":         "Knowledge Management",
  "Codex Plugin":    "Coding Agents",
  "Memory Layer":    "Knowledge Management",
  "AI for Kids":     "Parenting",          // educator prompts get flagged for manual override to "Education"
  "Vibe Coding":     "Coding Agents",
  "Plugin":          "Coding Agents",
};

// Tag-based topic mapping (only used when series didn't match)
const TAG_TO_TOPIC: { match: (tags: string[]) => boolean; topic: string }[] = [
  { match: t => t.some(x => /^(local-ai|hardware-planning|ollama|lm[- ]studio|gpu)/i.test(x)), topic: "Local AI" },
  { match: t => t.some(x => /^(email|sales|outreach|copywriting|cold)/i.test(x)),               topic: "Sales" },
  { match: t => t.some(x => /^(meetings|weekly-review|productivity|planning)/i.test(x)),        topic: "Productivity" },
  { match: t => t.some(x => /^(rag|chatbot|llm)/i.test(x)),                                     topic: "LLM Engineering" },
  { match: t => t.some(x => /^(data-analysis|plotly|frequency-stability|etcher-logs)/i.test(x)), topic: "Data Analysis" },
  { match: t => t.some(x => /^(parenting|child-development|ai-literacy|cognitive-development)/i.test(x)), topic: "Parenting" },
  { match: t => t.some(x => /^(decision-making|build-vs-buy|prioritization|framework|bias-resistance)/i.test(x)), topic: "Decision-Making" },
  { match: t => t.some(x => /^(knowledge-management|wiki-architecture|institutional-knowledge|knowledge-systems)/i.test(x)), topic: "Knowledge Management" },
  { match: t => t.some(x => /^(ai-agents|agent-deployment|agent-safety|ai-reliability|agent-architecture|agent-evaluation|ai-safety)/i.test(x)), topic: "AI Agents" },
  { match: t => t.some(x => /^(platform-strategy|lock-in-analysis|enterprise-strategy|ai-strategy)/i.test(x)), topic: "AI Strategy" },
  { match: t => t.some(x => /^(measurement|comparison)/i.test(x)),                              topic: "AI Tools" },
  { match: t => t.some(x => /^(discovery|onboarding|personal-knowledge|capture|templates)/i.test(x)), topic: "Knowledge Management" },
  { match: t => t.some(x => /^(skill-building|skill-validation|skill-deployment)/i.test(x)),    topic: "AI Workflow" },
  { match: t => t.some(x => /^(workflow-automation|task-decomposition|task-handoff|automation|scheduling|delegation)/i.test(x)), topic: "AI Agents" },
  { match: t => t.some(x => /^(debugging|root-cause-analysis|problem-solving)/i.test(x)),       topic: "Coding Agents" },
];

function detectTopic(p: PromptRow, series: string | null): string | null {
  if (series && SERIES_TO_TOPIC[series]) return SERIES_TO_TOPIC[series];
  for (const { match, topic } of TAG_TO_TOPIC) {
    if (match(p.tags ?? [])) return topic;
  }
  return null;
}

// ─── Aliases — curated seeds for the named prompts in the plan ──────────

const ALIAS_SEEDS: Record<string, string[]> = {
  // by exact title
  "Rules Files or Claude.md Generator":                       ["claude md", "claude.md", "rules file", "agents.md", "cursorrules", "coding agent rules"],
  "Codex Plugin - Plugin Refinement Debugger":                ["plugin debugger", "debug codex plugin", "plugin not triggering", "skill refinement", "codex debugging"],
  "Hardware - Local AI Stack Planner & Setup":                ["local ai", "local llm", "hardware planner", "ollama", "lm studio", "gpu setup"],
  "Cold Email — Value Proposition":                           ["cold email", "value prop", "outreach email"],
  "Intent - Find the context gaps that make AI risky in your workflow": ["context gap", "ai risk", "institutional knowledge", "ai blind spots"],
  "AI Wiki - AI Wiki Maintenance Agent":                      ["wiki maintenance", "wiki update", "docs sync"],
  "The Open Loop Audit":                                      ["delegate to ai", "what can i delegate", "open loops", "async delegation"],
  "Find Which Open Loops Can Leave Your Desk":                ["delegate to ai", "what can i delegate", "open loops", "async delegation"],
  "Meeting Debrief":                                          ["meeting notes", "action items", "meeting summary"],
};

// Family-wide aliases — applied to every prompt in the named series
const SERIES_ALIASES: Record<string, string[]> = {
  "Deployment":   ["agent deployment", "production agent", "deployment readiness"],
  "AI for Kids":  ["kids ai", "children ai", "ai learning", "child ai project", "ai homework"],
};

function detectAliases(p: PromptRow, series: string | null): string[] {
  const fromTitle = ALIAS_SEEDS[p.title] ?? [];
  const fromSeries = series ? (SERIES_ALIASES[series] ?? []) : [];
  // Dedupe + filter out aliases that already appear in the title (low signal)
  const titleLower = p.title.toLowerCase();
  const merged = [...new Set([...fromTitle, ...fromSeries])];
  return merged.filter(a => !titleLower.includes(a.toLowerCase()));
}

// ─── Review flags ─────────────────────────────────────────────────────

function flagsFor(p: PromptRow, proposedTopic: string | null, proposedSeries: string | null): string[] {
  const flags: string[] = [];

  // AI for Kids: educator-audience prompts → suggest topic=Education instead of Parenting
  if (proposedSeries === "AI for Kids") {
    if (/educator|curriculum|assignment/i.test(p.title)) {
      flags.push("EDUCATION (override Parenting for educator-audience prompts)");
    }
  }

  // AI Deployment vs Deployment — flag for merge consideration
  if (proposedSeries === "AI Deployment") {
    flags.push("SERIES: consider merging into 'Deployment'");
  }

  // Plugin vs Codex Plugin — flag
  if (proposedSeries === "Plugin") {
    flags.push("SERIES: consider 'Codex Plugin' instead");
  }

  // No topic proposed
  if (!proposedTopic) {
    flags.push("NO_TOPIC (heuristics didn't match)");
  }

  return flags;
}

// ─── Output formatting ────────────────────────────────────────────────

function pad(s: string, n: number): string {
  s = s ?? "";
  return s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
}

function printDryRunTable(proposals: Proposal[]): void {
  console.log();
  console.log(pad("Title", 50) + pad("Series", 18) + pad("Topic", 22) + "Aliases / Flags");
  console.log("─".repeat(120));
  for (const p of proposals) {
    const series = p.proposedSeries ?? "(null)";
    const topic = p.proposedTopic ?? "(null)";
    const aliasesStr = p.proposedAliases.length > 0
      ? `[${p.proposedAliases.slice(0, 3).join(", ")}${p.proposedAliases.length > 3 ? ` +${p.proposedAliases.length - 3}` : ""}]`
      : "";
    const flagsStr = p.reviewFlags.length > 0 ? "  ⚠ " + p.reviewFlags.join("; ") : "";
    console.log(pad(p.title, 50) + pad(series, 18) + pad(topic, 22) + aliasesStr + flagsStr);
  }
  console.log();
}

function printSummary(proposals: Proposal[]): void {
  const seriesCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  let withAliases = 0;
  let flagged = 0;
  for (const p of proposals) {
    if (p.proposedSeries) seriesCounts[p.proposedSeries] = (seriesCounts[p.proposedSeries] ?? 0) + 1;
    if (p.proposedTopic)  topicCounts[p.proposedTopic]   = (topicCounts[p.proposedTopic]   ?? 0) + 1;
    if (p.proposedAliases.length > 0) withAliases++;
    if (p.reviewFlags.length > 0)     flagged++;
  }
  const seriesFilled = proposals.filter(p => p.proposedSeries).length;
  const topicFilled  = proposals.filter(p => p.proposedTopic).length;

  console.log("Series distribution:");
  for (const [k, v] of Object.entries(seriesCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(k, 24)} ${v}`);
  }
  console.log("Topic distribution:");
  for (const [k, v] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(k, 24)} ${v}`);
  }
  console.log();
  console.log(`Summary: ${proposals.length} prompts | series filled: ${seriesFilled} | topic filled: ${topicFilled} | aliases filled: ${withAliases} | flagged for review: ${flagged}`);
  console.log();
}

// ─── Apply ────────────────────────────────────────────────────────────

async function apply(proposals: Proposal[], overwrite: boolean): Promise<void> {
  console.log("\n========================================");
  console.log("BEFORE APPLY — run this in Supabase SQL Editor to preserve updated_at:");
  console.log("  ALTER TABLE prompts DISABLE TRIGGER prompts_updated_at;");
  console.log("========================================\n");

  let written = 0, skipped = 0, errors = 0;

  for (const p of proposals) {
    const update: Record<string, unknown> = {};

    if (p.proposedTopic !== null && (overwrite || p.currentTopic === null)) {
      update.topic = p.proposedTopic;
    }
    if (p.proposedSeries !== null && (overwrite || p.currentSeries === null)) {
      update.series = p.proposedSeries;
    }
    if (p.proposedAliases.length > 0 && (overwrite || p.currentAliases.length === 0)) {
      update.search_aliases = p.proposedAliases;
    }

    if (Object.keys(update).length === 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("prompts").update(update).eq("id", p.id);
    if (error) {
      console.error(`✗ ${p.title}: ${error.message}`);
      errors++;
    } else {
      written++;
    }
  }

  console.log(`\nWritten: ${written}  Skipped: ${skipped}  Errors: ${errors}`);
  console.log("\n========================================");
  console.log("AFTER APPLY — run this in Supabase SQL Editor to re-enable timestamps:");
  console.log("  ALTER TABLE prompts ENABLE TRIGGER prompts_updated_at;");
  console.log("========================================\n");
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes("--apply");
  const overwrite = args.includes("--overwrite");

  // Try the full select first; if the new columns don't exist (migration 005
  // not yet applied), fall back to a slim select so dry-run still works.
  let prompts: PromptRow[] = [];
  let migrationApplied = true;
  {
    const { data, error } = await supabase
      .from("prompts")
      .select("id, title, category, tags, use_cases, topic, series, search_aliases")
      .order("created_at", { ascending: true });

    if (!error) {
      prompts = (data ?? []) as PromptRow[];
    } else if (error.code === "42703") {
      migrationApplied = false;
      const fallback = await supabase
        .from("prompts")
        .select("id, title, category, tags, use_cases")
        .order("created_at", { ascending: true });
      if (fallback.error) {
        console.error("Failed to fetch prompts:", fallback.error.message);
        process.exit(1);
      }
      prompts = (fallback.data ?? []).map((p) => ({
        ...p,
        topic: null,
        series: null,
        search_aliases: [],
      })) as PromptRow[];
      console.log("⚠  Migration 005 not yet applied — dry-run is still useful for reviewing proposals.\n");
    } else {
      console.error("Failed to fetch prompts:", error.message);
      process.exit(1);
    }
  }

  const proposals: Proposal[] = prompts.map((p) => {
    const proposedSeries = detectSeries(p.title);
    const proposedTopic  = detectTopic(p, proposedSeries);
    const proposedAliases = detectAliases(p, proposedSeries);
    const reviewFlags = flagsFor(p, proposedTopic, proposedSeries);
    return {
      id: p.id,
      title: p.title,
      currentTopic: p.topic ?? null,
      currentSeries: p.series ?? null,
      currentAliases: p.search_aliases ?? [],
      proposedTopic,
      proposedSeries,
      proposedAliases,
      reviewFlags,
    };
  });

  printDryRunTable(proposals);
  printSummary(proposals);

  if (!applyMode) {
    console.log("DRY-RUN — no rows written. Run with --apply to write proposals.");
    console.log("Add --overwrite to overwrite existing non-empty values.");
    if (!migrationApplied) {
      console.log("\n⚠  Run migration 005_retrieval_metadata.sql in Supabase SQL Editor before --apply.");
    }
    return;
  }

  if (!migrationApplied) {
    console.error("ERROR: cannot --apply because migration 005_retrieval_metadata.sql has not been run.");
    console.error("Apply the migration in Supabase SQL Editor first, then re-run with --apply.");
    process.exit(1);
  }

  await apply(proposals, overwrite);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
