/**
 * Tests for lib/auto-fill-merge.ts — the most fragile piece of Phase 6c.
 * Run via: npm run test:merge
 *
 * No test framework: each assertion exits non-zero with a clear message
 * on failure. Successful run prints "✓ all N assertions passed".
 */

import { mergeAutoFill, hasAnyBlankField, type AutoFillFields } from "../lib/auto-fill-merge";

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`✗ ${label}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function empty(): AutoFillFields {
  return {
    title: null, summary: null, category: null, topic: null, series: null,
    tags: [], search_aliases: [], use_cases: [], notes: null,
    required_variables: [], optional_variables: [],
  };
}

const llm: AutoFillFields = {
  title: "LLM Title",
  summary: "LLM summary",
  category: "Engineering",
  topic: "AI Agents",
  series: null,
  tags: ["llm-tag-1", "llm-tag-2"],
  search_aliases: ["llm alias"],
  use_cases: ["llm use case"],
  notes: "LLM notes",
  required_variables: [{ name: "var_x", type: "text", required: true }],
  optional_variables: [],
};

// 1. All fields blank → LLM values fill everything.
{
  const result = mergeAutoFill(empty(), llm);
  assertEqual("all blank → llm fills everything", result, llm);
}

// 2. User typed title → preserved exactly, byte-for-byte.
{
  const user = { ...empty(), title: "Open Brain Spark" };
  const result = mergeAutoFill(user, llm);
  assertEqual("user title preserved", result.title, "Open Brain Spark");
  assertEqual("other fields filled by llm", result.summary, "LLM summary");
}

// 3. User typed title with leading/trailing whitespace → preserved (no trim).
{
  const user = { ...empty(), title: "  Spaced Title  " };
  const result = mergeAutoFill(user, llm);
  assertEqual("whitespace-padded title preserved exactly", result.title, "  Spaced Title  ");
}

// 4. User typed only whitespace → treated as blank → filled by LLM.
{
  const user = { ...empty(), title: "   " };
  const result = mergeAutoFill(user, llm);
  assertEqual("whitespace-only title is blank → llm fills", result.title, "LLM Title");
}

// 5. User typed empty string → blank → filled.
{
  const user = { ...empty(), title: "" };
  const result = mergeAutoFill(user, llm);
  assertEqual("empty-string title → llm fills", result.title, "LLM Title");
}

// 6. User filled tags → preserved; LLM tags ignored.
{
  const user = { ...empty(), tags: ["mine-1", "mine-2"] };
  const result = mergeAutoFill(user, llm);
  assertEqual("user tags preserved", result.tags, ["mine-1", "mine-2"]);
}

// 7. User has empty tags array → LLM tags fill.
{
  const user = { ...empty(), tags: [] };
  const result = mergeAutoFill(user, llm);
  assertEqual("empty tags → llm fills", result.tags, ["llm-tag-1", "llm-tag-2"]);
}

// 8. LLM returned null for series, user blank → result is null.
{
  const user = empty();
  const llmNoSeries = { ...llm, series: null };
  const result = mergeAutoFill(user, llmNoSeries);
  assertEqual("null series stays null when both blank", result.series, null);
}

// 9. User typed series, LLM also has one → user wins.
{
  const user = { ...empty(), series: "My Custom Series" };
  const llmWithSeries = { ...llm, series: "Deployment" };
  const result = mergeAutoFill(user, llmWithSeries);
  assertEqual("user series wins over llm", result.series, "My Custom Series");
}

// 10. Mixed: user filled title + tags, everything else blank.
{
  const user = { ...empty(), title: "User Title", tags: ["a", "b"] };
  const result = mergeAutoFill(user, llm);
  assertEqual("mixed: title preserved",   result.title,   "User Title");
  assertEqual("mixed: tags preserved",    result.tags,    ["a", "b"]);
  assertEqual("mixed: summary from llm",  result.summary, "LLM summary");
  assertEqual("mixed: topic from llm",    result.topic,   "AI Agents");
}

// 11. User filled variables → preserved.
{
  const userVars = [{ name: "user_var", type: "text" as const, required: true }];
  const user = { ...empty(), required_variables: userVars };
  const result = mergeAutoFill(user, llm);
  assertEqual("user variables preserved", result.required_variables, userVars);
}

// 12. hasAnyBlankField — empty payload returns true.
{
  assertEqual("hasAnyBlankField(empty) === true", hasAnyBlankField(empty()), true);
}

// 13. hasAnyBlankField — fully filled payload returns false.
{
  const filled: AutoFillFields = {
    title: "T", summary: "S", category: "C", topic: "P", series: null,
    tags: ["x"], search_aliases: ["y"], use_cases: ["z"], notes: "N",
    required_variables: [], optional_variables: [],
  };
  assertEqual("hasAnyBlankField(fully filled, series=null) === false", hasAnyBlankField(filled), false);
}

// 14. hasAnyBlankField ignores series — null series doesn't trigger auto-fill.
{
  const noSeries: AutoFillFields = {
    title: "T", summary: "S", category: "C", topic: "P", series: null,
    tags: ["x"], search_aliases: ["y"], use_cases: ["z"], notes: "N",
    required_variables: [], optional_variables: [],
  };
  assertEqual("series=null does not trigger hasAnyBlankField", hasAnyBlankField(noSeries), false);
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✓ all ${passed} assertions passed`);
