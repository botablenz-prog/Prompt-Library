/**
 * Search benchmark — runs a fixed list of real-memory queries against the
 * deployed search pipeline and reports whether the expected prompt is in
 * top 1 / top 3 / top 5.
 *
 * Usage:
 *   npm run benchmark                       # run, print table, save timestamped JSON
 *   npm run benchmark -- --baseline        # also save to .benchmark/baseline.json
 *   npm run benchmark -- --compare         # diff against baseline.json
 */

import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/embeddings/pipeline";
import { mergeResults } from "../lib/search/scoring";

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

type Verdict = "PASS_TOP1" | "PASS_TOP3" | "PASS_TOP5" | "FAIL_NOT_TOP5" | "NO_EXPECTATION";

type QueryKind = "specific-title" | "fuzzy-intent" | "broad-family" | "smoke-test";

interface Query {
  q: string;
  kind: QueryKind;
  expectedTitle?: string;
  expectedFamily?: string;
  note?: string;
}

interface QueryResult {
  query: string;
  kind: QueryKind;
  top5: { rank: number; id: string; title: string; score: number }[];
  expectedTitle?: string;
  expectedFamily?: string;
  expectedRank: number | null;
  verdict: Verdict;
  note?: string;
}

const QUERIES: Query[] = [
  // SPECIFIC-TITLE — words from the query appear directly in the title. Today's baseline passes all of these at TOP1.
  // Kept as a regression floor: any change in later phases that drops one of these is a blocker.
  { q: "agent deployment",            kind: "specific-title", expectedFamily: "Deployment / AI Agents" },
  { q: "codebase agent readiness",    kind: "specific-title", expectedTitle: "Deployment - Codebase Agent-Readiness Audit" },
  { q: "build or buy agent",          kind: "specific-title", expectedTitle: "Deployment - Build-or-Buy Diagnostic" },
  { q: "consulting proposal",         kind: "specific-title", expectedTitle: "Deployment - Consulting Proposal Decomposer" },
  { q: "skill builder",               kind: "specific-title", expectedTitle: "Skill Builder (Output-Extraction Method)" },
  { q: "agent readiness skill",       kind: "specific-title", expectedTitle: "Skill - Agent - Agent-Readiness Audit" },
  { q: "claude md rules file",        kind: "specific-title", expectedTitle: "Rules Files or Claude.md Generator" },
  { q: "plugin debugger",             kind: "specific-title", expectedTitle: "Codex Plugin - Plugin Refinement Debugger" },
  { q: "open loops",                  kind: "specific-title", expectedFamily: "Open Loop (likely duplicate — flag)" },
  { q: "kids ai project",             kind: "specific-title", expectedFamily: "AI for Kids" },
  { q: "wiki maintenance",            kind: "specific-title", expectedTitle: "AI Wiki - AI Wiki Maintenance Agent" },
  { q: "local ai hardware",           kind: "specific-title", expectedTitle: "Hardware - Local AI Stack Planner & Setup" },
  { q: "meeting notes",               kind: "specific-title", expectedTitle: "Meeting Debrief" },
  { q: "cold email value proposition", kind: "specific-title", expectedTitle: "Cold Email — Value Proposition" },
  { q: "context gaps ai risk",        kind: "specific-title", expectedTitle: "Intent - Find the context gaps that make AI risky in your workflow" },

  // FUZZY-INTENT — describe the prompt's purpose without using its exact title words.
  // These are the real day-to-day failure mode (user feedback: "I type approximate search words or describe the intent").
  { q: "what can i delegate to ai",                kind: "fuzzy-intent", expectedTitle: "The Open Loop Audit", note: "intent: find work to hand off" },
  { q: "build agent in house or hire vendor",      kind: "fuzzy-intent", expectedTitle: "Deployment - Build-or-Buy Diagnostic", note: "paraphrase" },
  { q: "is my code ready for ai agents",           kind: "fuzzy-intent", expectedTitle: "Deployment - Codebase Agent-Readiness Audit", note: "paraphrase" },
  { q: "design knowledge system for ai",           kind: "fuzzy-intent", expectedTitle: "Memory Layer - AI-Native Knowledge Architecture Advisor", note: "intent" },
  { q: "find contradictions in my docs",           kind: "fuzzy-intent", expectedTitle: "Memory Layer - Knowledge Base Drift & Contradiction Auditor", note: "intent" },
  { q: "is my kid using ai too much",              kind: "fuzzy-intent", expectedTitle: "AI for Kids - The Cognitive Offloading Check-In", note: "intent" },
  { q: "redesign homework for ai era",             kind: "fuzzy-intent", expectedTitle: "AI for Kids - AI-Age Assignment Redesigner (For Educators)", note: "paraphrase" },
  { q: "should i run ai locally or cloud",         kind: "fuzzy-intent", expectedTitle: "Local vs Cloud AI Workflow Router", note: "paraphrase" },
  { q: "compare two ai tools head to head",        kind: "fuzzy-intent", expectedTitle: "AI Deployment - AI Tool Head-to-Head Measurement Coach", note: "paraphrase" },
  { q: "is this plugin safe",                      kind: "fuzzy-intent", expectedTitle: "Codex Plugin - Plugin Trust Evaluator", note: "intent" },
  { q: "decide between prompt skill plugin",       kind: "fuzzy-intent", expectedTitle: "Plugin - Prompt, Skill, or Plugin Decision Advisor", note: "paraphrase" },
  { q: "find ways my agent can fail",              kind: "fuzzy-intent", expectedTitle: "Agent Failure Mode Audit", note: "intent" },
  { q: "overnight research on big decision",       kind: "fuzzy-intent", expectedTitle: "Stress-Test a Decision With Overnight Research", note: "paraphrase" },
  { q: "audit ai built app security",              kind: "fuzzy-intent", expectedTitle: "Vibe Coding - AI-Built App Security & Resilience Audit", note: "paraphrase" },
  { q: "am i ready to deploy agents",              kind: "fuzzy-intent", expectedTitle: "The Agent Deployment Readiness Assessment", note: "paraphrase" },
  { q: "scaffold a new codex plugin",              kind: "fuzzy-intent", expectedTitle: "Codex Plugin - Plugin Starter Builder", note: "paraphrase" },
  { q: "write evals for my domain",                kind: "fuzzy-intent", expectedTitle: "Intent - Write domain-specific evals and guardrails that stop AI from making locally right but organizationally wrong decisions", note: "paraphrase" },
  { q: "engineer brief for non technical founder", kind: "fuzzy-intent", expectedTitle: "Technical Briefing Generator for Non-Technical Founders", note: "paraphrase" },
  { q: "capture decision context for ai",          kind: "fuzzy-intent", expectedTitle: "Intent - Capture decision context so AI understands the why, not just the outcome", note: "paraphrase" },
  { q: "turn meeting notes into action items",     kind: "fuzzy-intent", expectedTitle: "Meeting Debrief", note: "paraphrase" },

  // BROAD-FAMILY — testing whether series-mates cluster in top results.
  // Verdict is informational (NO_EXPECTATION) — manual inspection of top 5 is what matters.
  { q: "everything about deployment",   kind: "broad-family", expectedFamily: "Deployment series" },
  { q: "all the intent prompts",        kind: "broad-family", expectedFamily: "Intent series" },
  { q: "wiki tools",                    kind: "broad-family", expectedFamily: "AI Wiki series" },
  { q: "codex plugin stuff",            kind: "broad-family", expectedFamily: "Codex Plugin series" },
  { q: "memory layer",                  kind: "broad-family", expectedFamily: "Memory Layer series" },

  // SMOKE-TESTS — wider topics not yet in the library; should not error and should not return wildly off-topic noise.
  { q: "tax",        kind: "smoke-test", note: "future topic — no expected hit" },
  { q: "investment", kind: "smoke-test", note: "future topic — no expected hit" },
  { q: "space",      kind: "smoke-test", note: "future topic — no expected hit" },
];

async function runOne(query: string): Promise<QueryResult["top5"]> {
  let queryVec: number[] | null = null;
  try {
    queryVec = await embed(query);
  } catch {
    queryVec = null;
  }

  const ftsPromise = supabase
    .from("prompts")
    .select("id")
    .textSearch("fts", query, { type: "plain", config: "english" })
    .limit(20);

  const vecPromise = queryVec
    ? supabase.rpc("search_by_embedding", {
        query_embedding: `[${queryVec.join(",")}]`,
        match_count: 20,
      })
    : Promise.resolve({ data: [], error: null });

  const [{ data: ftsData }, { data: vecData }] = await Promise.all([ftsPromise, vecPromise]);

  const ftsSet = new Set<string>((ftsData ?? []).map((r: { id: string }) => r.id));
  const vectorResults = (vecData ?? []) as { id: string; vec_score: number }[];

  const ranked = mergeResults(vectorResults, ftsSet);
  const top5 = ranked.slice(0, 5);

  if (top5.length === 0) return [];

  const { data: rows } = await supabase
    .from("prompts")
    .select("id, title")
    .in("id", top5.map(r => r.id));

  const titleMap = new Map((rows ?? []).map((r: { id: string; title: string }) => [r.id, r.title]));
  return top5.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    title: titleMap.get(r.id) ?? "(missing)",
    score: Number(r.score.toFixed(4)),
  }));
}

function verdictFor(q: Query, top5: QueryResult["top5"]): { verdict: Verdict; expectedRank: number | null } {
  if (!q.expectedTitle) {
    return { verdict: "NO_EXPECTATION", expectedRank: null };
  }
  const idx = top5.findIndex(r => r.title === q.expectedTitle);
  if (idx === -1) return { verdict: "FAIL_NOT_TOP5", expectedRank: null };
  if (idx === 0)  return { verdict: "PASS_TOP1", expectedRank: 1 };
  if (idx <= 2)   return { verdict: "PASS_TOP3", expectedRank: idx + 1 };
  return { verdict: "PASS_TOP5", expectedRank: idx + 1 };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
}

function printTable(results: QueryResult[]): void {
  const groups: Record<QueryKind, QueryResult[]> = {
    "specific-title": [], "fuzzy-intent": [], "broad-family": [], "smoke-test": [],
  };
  for (const r of results) groups[r.kind].push(r);

  for (const kind of ["specific-title", "fuzzy-intent", "broad-family", "smoke-test"] as QueryKind[]) {
    const items = groups[kind];
    if (items.length === 0) continue;
    console.log(`\n── ${kind.toUpperCase()} (${items.length}) ──`);
    console.log(pad("Query", 44) + pad("Verdict", 16) + pad("Rank", 6) + "Top result");
    console.log("─".repeat(44 + 16 + 6 + 50));
    for (const r of items) {
      const top = r.top5[0]?.title ?? "(no results)";
      const rank = r.expectedRank?.toString() ?? "—";
      console.log(pad(r.query, 44) + pad(r.verdict, 16) + pad(rank, 6) + top);
    }
    const groupCounts: Record<Verdict, number> = {
      PASS_TOP1: 0, PASS_TOP3: 0, PASS_TOP5: 0, FAIL_NOT_TOP5: 0, NO_EXPECTATION: 0,
    };
    for (const r of items) groupCounts[r.verdict]++;
    console.log("  Group summary:", JSON.stringify(groupCounts));
  }
  console.log();
}

function printDetails(results: QueryResult[]): void {
  for (const r of results) {
    console.log(`\n[${r.verdict}] ${r.query}`);
    if (r.expectedTitle) console.log(`  expected: ${r.expectedTitle}`);
    if (r.expectedFamily) console.log(`  expected family: ${r.expectedFamily}`);
    if (r.note) console.log(`  note: ${r.note}`);
    for (const t of r.top5) {
      const marker = t.title === r.expectedTitle ? " ← expected" : "";
      console.log(`  ${t.rank}. [${t.score}] ${t.title}${marker}`);
    }
  }
}

function diffAgainst(current: QueryResult[], baseline: QueryResult[]): void {
  console.log("\n=== Diff vs baseline ===\n");
  const baseMap = new Map(baseline.map(r => [r.query, r]));
  let regressed = 0;
  let improved = 0;
  let unchanged = 0;
  for (const cur of current) {
    const base = baseMap.get(cur.query);
    if (!base) {
      console.log(`  + NEW       ${cur.query} → ${cur.verdict}`);
      continue;
    }
    if (cur.verdict === base.verdict && cur.top5[0]?.id === base.top5[0]?.id) {
      unchanged++;
      continue;
    }
    const arrow = verdictRank(cur.verdict) < verdictRank(base.verdict) ? "▲ better"
                : verdictRank(cur.verdict) > verdictRank(base.verdict) ? "▼ worse "
                : "= same  ";
    if (arrow.startsWith("▲")) improved++;
    else if (arrow.startsWith("▼")) regressed++;
    else unchanged++;
    console.log(`  ${arrow} ${pad(cur.query, 36)} ${base.verdict} → ${cur.verdict}`);
    if (cur.top5[0]?.id !== base.top5[0]?.id) {
      console.log(`             was: ${base.top5[0]?.title ?? "—"}`);
      console.log(`             now: ${cur.top5[0]?.title ?? "—"}`);
    }
  }
  console.log(`\nImproved: ${improved}  Regressed: ${regressed}  Unchanged: ${unchanged}\n`);
}

function verdictRank(v: Verdict): number {
  switch (v) {
    case "PASS_TOP1":      return 0;
    case "PASS_TOP3":      return 1;
    case "PASS_TOP5":      return 2;
    case "FAIL_NOT_TOP5":  return 3;
    case "NO_EXPECTATION": return 4;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const saveBaseline = args.includes("--baseline");
  const compare = args.includes("--compare");

  const results: QueryResult[] = [];

  for (const q of QUERIES) {
    process.stdout.write(`Running: "${q.q}"... `);
    const top5 = await runOne(q.q);
    const { verdict, expectedRank } = verdictFor(q, top5);
    results.push({
      query: q.q,
      kind: q.kind,
      top5,
      expectedTitle: q.expectedTitle,
      expectedFamily: q.expectedFamily,
      expectedRank,
      verdict,
      note: q.note,
    });
    console.log(verdict);
  }

  printTable(results);
  printDetails(results);

  const fs = require("fs");
  const path = require("path");
  fs.mkdirSync(".benchmark", { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(".benchmark", `${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Saved: ${outPath}`);

  if (saveBaseline) {
    const baselinePath = path.join(".benchmark", "baseline.json");
    fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
    console.log(`Saved baseline: ${baselinePath}`);
  }

  if (compare) {
    const baselinePath = path.join(".benchmark", "baseline.json");
    if (!fs.existsSync(baselinePath)) {
      console.log("(no baseline.json to compare against — run with --baseline first)");
    } else {
      const baseline: QueryResult[] = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      diffAgainst(results, baseline);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
