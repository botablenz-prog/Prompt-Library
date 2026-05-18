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

interface Query {
  q: string;
  expectedTitle?: string;
  expectedFamily?: string;
  note?: string;
}

interface QueryResult {
  query: string;
  top5: { rank: number; id: string; title: string; score: number }[];
  expectedTitle?: string;
  expectedFamily?: string;
  expectedRank: number | null;
  verdict: Verdict;
  note?: string;
}

const QUERIES: Query[] = [
  { q: "agent deployment",            expectedFamily: "Deployment / AI Agents" },
  { q: "codebase agent readiness",    expectedTitle: "Deployment - Codebase Agent-Readiness Audit" },
  { q: "build or buy agent",          expectedTitle: "Deployment - Build-or-Buy Diagnostic" },
  { q: "consulting proposal",         expectedTitle: "Deployment - Consulting Proposal Decomposer" },
  { q: "skill builder",               expectedTitle: "Skill Builder (Output-Extraction Method)" },
  { q: "agent readiness skill",       expectedTitle: "Skill - Agent - Agent-Readiness Audit" },
  { q: "claude md rules file",        expectedTitle: "Rules Files or Claude.md Generator" },
  { q: "plugin debugger",             expectedTitle: "Codex Plugin - Plugin Refinement Debugger" },
  { q: "open loops",                  expectedFamily: "Open Loop (likely duplicate — flag)" },
  { q: "kids ai project",             expectedFamily: "AI for Kids" },
  { q: "wiki maintenance",            expectedTitle: "AI Wiki - AI Wiki Maintenance Agent" },
  { q: "local ai hardware",           expectedTitle: "Hardware - Local AI Stack Planner & Setup" },
  { q: "meeting notes",               expectedTitle: "Meeting Debrief" },
  { q: "cold email value proposition", expectedTitle: "Cold Email — Value Proposition" },
  { q: "context gaps ai risk",        expectedTitle: "Intent - Find the context gaps that make AI risky in your workflow" },
  { q: "tax",                         note: "future topic smoke test — no expected hit" },
  { q: "investment",                  note: "future topic smoke test — no expected hit" },
  { q: "space",                       note: "future topic smoke test — no expected hit" },
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
  console.log();
  console.log(pad("Query", 36) + pad("Verdict", 16) + pad("Rank", 6) + "Top result");
  console.log("─".repeat(36 + 16 + 6 + 40));
  for (const r of results) {
    const top = r.top5[0]?.title ?? "(no results)";
    const rank = r.expectedRank?.toString() ?? "—";
    console.log(pad(r.query, 36) + pad(r.verdict, 16) + pad(rank, 6) + top);
  }
  console.log();
  const counts: Record<Verdict, number> = {
    PASS_TOP1: 0, PASS_TOP3: 0, PASS_TOP5: 0, FAIL_NOT_TOP5: 0, NO_EXPECTATION: 0,
  };
  for (const r of results) counts[r.verdict]++;
  console.log("Summary:", JSON.stringify(counts));
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
