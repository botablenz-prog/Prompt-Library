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
  // "AI Deployment - " is intentionally not a series: per user, these are AI Tool
  // measurement prompts, not agent-deployment; topic alone disambiguates them.
  { regex: /^Intent - /,               series: "Intent" },
  { regex: /^Skill - /,                series: "Skill" },
  { regex: /^Claude Dispatch - /,      series: "Claude Dispatch" },
  { regex: /^AI Wiki - /,              series: "AI Wiki" },
  { regex: /^Codex Plugin - /,         series: "Codex Plugin" },
  { regex: /^Memory Layer - /,         series: "Memory Layer" },
  { regex: /^AI for [Kk]ids - /,       series: "AI for Kids" },
  { regex: /^(AI )?Vibe Coding - /,    series: "Vibe Coding" },
  { regex: /^Plugin - /,               series: "Plugin" },
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

// Priority-ordered topic detection. Title keywords first (most specific
// signal), then series-to-topic, then tag families from specific to broad.
// First match wins.
function detectTopic(p: PromptRow, series: string | null): string | null {
  const title = p.title;
  const tags = p.tags ?? [];
  const hasTag = (re: RegExp) => tags.some((t) => re.test(t));

  // 1. Coding Agents — title is a strong signal
  if (/(claude\.md|cursor|rules file|vibe coding|vibe coded|codex skill\.md|codex plugin)/i.test(title))
    return "Coding Agents";
  if (hasTag(/^(cursor|codex|claude|rules-generation|vibe-coding|skill-authoring|plugin-debugging|plugin-design|safe-coding)/i))
    return "Coding Agents";

  // 2. Series map — a named series is a stronger signal than any individual tag.
  //    Prevents 'Deployment - Consulting Proposal Decomposer' being mis-tagged
  //    AI Tools because it has a `procurement` tag.
  if (series && SERIES_TO_TOPIC[series]) return SERIES_TO_TOPIC[series];

  // 3. AI Strategy — product/platform-level positioning beats generic "ai-agents" tag
  if (hasTag(/^(compression|product-risk|positioning|platform-strategy|lock-in-analysis|enterprise-strategy|ai-strategy|switching-costs)/i))
    return "AI Strategy";

  // 4. AI Tools — head-to-head / procurement / capability-evaluator prompts
  if (hasTag(/^(measurement|comparison|ai-evaluation|enterprise-tools|capability-assessment|procurement)/i))
    return "AI Tools";

  // 5. Local AI
  if (hasTag(/^(local-ai|hardware-planning|ollama|lm-studio|gpu)/i)) return "Local AI";

  // 6. Strong AI Agents tags — beat downstream Decision-Making / Productivity rules
  if (hasTag(/^(agent-deployment|agent-safety|ai-reliability|agent-architecture|agent-evaluation|ai-safety|failure-modes|operational-risk|agent-testing|agent-audit|risk-audit|approval-gates|human-in-the-loop|harm-reduction|production-safety|readiness-check)/i))
    return "AI Agents";

  // 7. Parenting / Education (Education override is added later in flagsFor)
  if (hasTag(/^(parenting|child-development|ai-literacy|cognitive-development)/i)) return "Parenting";

  // 8. Sales
  if (hasTag(/^(email|sales|outreach|copywriting)/i)) return "Sales";

  // 9. Productivity — explicit productivity tags, not workflow-automation
  if (hasTag(/^(meetings|weekly-review|planning|notes|productivity|async)/i)) return "Productivity";

  // 10. LLM Engineering
  if (hasTag(/^(rag|chatbot|llm|document-processing)/i)) return "LLM Engineering";

  // 11. Data Analysis
  if (hasTag(/^(data-analysis|plotly|frequency-stability|etcher-logs|frequency-tracking)/i)) return "Data Analysis";

  // 12. AI Workflow — skill-building prompts
  if (hasTag(/^(skill-building|skill-validation|skill-deployment|methodology-extraction|workflow-optimization|backlog-prioritization)/i))
    return "AI Workflow";

  // 13. Decision-Making — must come before the generic ai-agents catch-all
  //     so that "decide between agents" beats "this is about agents"
  if (hasTag(/^(decision-making|build-vs-buy|prioritization|framework|bias-resistance|technical-fit|product-analysis|product-selection|build-or-buy|competitive-intelligence|cost-analysis)/i))
    return "Decision-Making";

  // 14. Knowledge Management — broad bucket for capture / wiki / discovery / KM tags
  if (hasTag(/^(knowledge-management|wiki-architecture|institutional-knowledge|knowledge-systems|personal-knowledge|capture|templates|discovery|onboarding|metadata|context-mapping|documentation|wiki-maintenance|editorial-policy|synthesis|engineering)/i))
    return "Knowledge Management";

  // 15. AI Agents — generic catch-all (delegation / automation / generic ai-agents tag)
  if (hasTag(/^(ai-agents|delegation|workflow-automation|automation|scheduling|task-decomposition|task-handoff|brief-writing|cloud-tasks|open-loops|automation-audit|async-work|dispatch)/i))
    return "AI Agents";

  // 16. Coding Agents — fallback for debugging / problem-solving tags
  if (hasTag(/^(debugging|root-cause-analysis|problem-solving|implementation-planning)/i)) return "Coding Agents";

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
  if (proposedSeries === "AI for Kids" && /educator|curriculum|assignment/i.test(p.title)) {
    flags.push("EDUCATION (override Parenting for educator-audience prompts)");
  }

  // No topic proposed — heuristics didn't match, auto-fill or manual edit needed later
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
