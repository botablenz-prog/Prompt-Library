/**
 * Duplicate detection report. Read-only — never writes.
 *
 * Heuristics (printed in confidence order, highest first):
 *   1. Exact body hash       — identical body text, trimmed.
 *   2. Normalised body hash  — same after lowercase + whitespace collapse +
 *                              {{var}} placeholders stripped.
 *   3. Similar title         — Levenshtein distance <= 5 OR token Jaccard
 *                              similarity >= 0.6.
 *   4. Identical signatures  — same tags AND same use_cases (different body).
 *
 * Usage:
 *   npm run report:duplicates              # prints markdown to stdout,
 *                                          # saves to .benchmark/duplicates.md
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

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

interface Row {
  id: string;
  title: string;
  body: string;
  category: string | null;
  topic: string | null;
  series: string | null;
  tags: string[];
  use_cases: string[];
  created_at: string;
  updated_at: string;
}

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

function normaliseBody(s: string): string {
  return s.toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, " VAR ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array(a.length + 1).fill(null).map(() => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function titleTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function fmtRow(r: Row, extra: string[] = []): string {
  const parts = [
    `\`${r.id.slice(0, 8)}\``,
    `**${r.title}**`,
    r.topic ? `topic: ${r.topic}` : null,
    r.series ? `series: ${r.series}` : null,
    r.category ? `cat: ${r.category}` : null,
    r.tags.length ? `tags: [${r.tags.join(", ")}]` : null,
    `body: ${r.body.length} chars`,
    `updated: ${r.created_at.slice(0, 10)}`,
    ...extra,
  ].filter(Boolean);
  return "- " + parts.join(" · ");
}

async function main() {
  const { data, error } = await supabase
    .from("prompts")
    .select("id, title, body, category, topic, series, tags, use_cases, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch prompts:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const lines: string[] = [];
  const log = (s: string) => { lines.push(s); console.log(s); };

  log(`# Duplicate Report — ${new Date().toISOString().slice(0, 10)}`);
  log("");
  log(`Scanned **${rows.length} prompts**. Heuristics run in confidence order.`);
  log("");

  // ── 1. Exact body hash ──────────────────────────────────────────────
  {
    const byHash = new Map<string, Row[]>();
    for (const r of rows) {
      const h = sha1(r.body.trim());
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h)!.push(r);
    }
    const clusters = Array.from(byHash.values()).filter((c) => c.length > 1);
    log(`## 1. Exact body hash (${clusters.length} cluster${clusters.length === 1 ? "" : "s"})`);
    if (clusters.length === 0) {
      log("_No exact body duplicates._");
    } else {
      for (const c of clusters) {
        log(`\n### Cluster (body hash ${sha1(c[0].body.trim())})`);
        for (const r of c) log(fmtRow(r));
      }
    }
    log("");
  }

  // ── 2. Normalised body hash (excluding exact dups already found) ────
  {
    const byNorm = new Map<string, Row[]>();
    for (const r of rows) {
      const h = sha1(normaliseBody(r.body));
      if (!byNorm.has(h)) byNorm.set(h, []);
      byNorm.get(h)!.push(r);
    }
    const clusters = Array.from(byNorm.values()).filter((c) => {
      if (c.length < 2) return false;
      // Skip if it was already an exact dup
      const exactHashes = new Set(c.map((r) => sha1(r.body.trim())));
      return exactHashes.size > 1;
    });
    log(`## 2. Normalised body hash — different exact, same normalised (${clusters.length} cluster${clusters.length === 1 ? "" : "s"})`);
    if (clusters.length === 0) {
      log("_No additional matches after exact-body pass._");
    } else {
      for (const c of clusters) {
        log(`\n### Cluster (normalised hash ${sha1(normaliseBody(c[0].body))})`);
        for (const r of c) log(fmtRow(r));
      }
    }
    log("");
  }

  // ── 3. Similar titles ──────────────────────────────────────────────
  {
    log(`## 3. Similar titles (Levenshtein ≤ 5 OR token Jaccard ≥ 0.6)`);
    const pairs: { a: Row; b: Row; lev: number; jac: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        const ta = titleTokens(a.title), tb = titleTokens(b.title);
        const jac = jaccard(ta, tb);
        const lev = a.title.length < 100 && b.title.length < 100
          ? levenshtein(a.title.toLowerCase(), b.title.toLowerCase())
          : 999;
        if (lev <= 5 || jac >= 0.6) {
          pairs.push({ a, b, lev, jac });
        }
      }
    }
    if (pairs.length === 0) {
      log("_No similar-title pairs._");
    } else {
      pairs.sort((x, y) => y.jac - x.jac || x.lev - y.lev);
      for (const p of pairs) {
        log(`\n### Pair (lev=${p.lev}, jaccard=${p.jac.toFixed(2)})`);
        log(fmtRow(p.a));
        log(fmtRow(p.b));
      }
    }
    log("");
  }

  // ── 4. Identical tags + use_cases (with different body) ────────────
  {
    log(`## 4. Identical tags AND use_cases (different body)`);
    const sig = (r: Row) => JSON.stringify({ tags: [...r.tags].sort(), use_cases: [...r.use_cases].sort() });
    const bySig = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.tags.length === 0 && r.use_cases.length === 0) continue; // skip empties
      const s = sig(r);
      if (!bySig.has(s)) bySig.set(s, []);
      bySig.get(s)!.push(r);
    }
    const clusters = Array.from(bySig.values()).filter((c) => {
      if (c.length < 2) return false;
      // Only flag if bodies aren't already identical (those are in cluster 1)
      const bodyHashes = new Set(c.map((r) => sha1(r.body.trim())));
      return bodyHashes.size > 1;
    });
    if (clusters.length === 0) {
      log("_No additional matches with same tags+use_cases but different body._");
    } else {
      for (const c of clusters) {
        log(`\n### Cluster (same tags + use_cases)`);
        for (const r of c) log(fmtRow(r));
      }
    }
    log("");
  }

  // ── Summary ────────────────────────────────────────────────────────
  log("---");
  log("");
  log("Nothing is auto-deleted. Review each cluster manually and decide which row is canonical.");
  log("To merge, copy any aliases/topic/series from the duplicate to the canonical row, then delete the duplicate via the UI.");

  mkdirSync(".benchmark", { recursive: true });
  const outPath = join(".benchmark", "duplicates.md");
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\nSaved: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
