import type { MatchSignals } from "@/lib/types";

export interface CandidateRow {
  id: string;
  title: string | null;
  summary: string | null;
  body: string | null;
  tags: string[] | null;
  category: string | null;
  topic: string | null;
  series: string | null;
  search_aliases: string[] | null;
  use_cases: string[] | null;
  required_variables: { name: string }[] | null;
  optional_variables: { name: string }[] | null;
}

export interface ScoredResult {
  id: string;
  score: number;
  matchSignals: MatchSignals;
}

// Scoring is additive on top of the Phase 4 baseline. The baseline alone
// already passes 12/12 specific-title queries at TOP1 and 17/20 fuzzy-
// intent queries at TOP1. The bonuses below only disambiguate cases where
// the baseline ties or near-ties: same-series prompts, broad-family
// queries, exact alias hits.
//
// Penalties remove score; bonuses add it. Nothing is normalised across the
// batch (no fts_rank/max divisor) because normalisation makes
// non-top-FTS hits LOSE score they used to have under the flat-bonus
// baseline.

const BASE_VEC = 0.80;
const BASE_FTS = 0.20;

const BONUS = {
  aliasExact:     0.10,
  titleSubstring: 0.18,
  titleStrong:    0.12,    // 2+ token overlap, plus titleStrongStep per extra hit, capped at titleSubstring
  titleStrongStep: 0.03,
  titleAny:       0.08,    // 1 token overlap
  seriesMatch:    0.05,
  topicMatch:     0.03,
  tagSubtoken:    0.03,
  variableExact:  0.05,
  useCaseStrong:  0.03,
};

const PENALTY = {
  bodyOnly: -0.05,
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with",
  "my", "your", "is", "are", "was", "what", "who", "that", "this", "by",
  "be", "i", "me", "do", "does", "can", "should", "how", "it", "from",
  "at", "as", "but", "if", "so", "up", "any", "all", "am",
]);

// Tiny English plural-stemmer so "decisions" matches "decision",
// "contradictions" matches "contradiction", "agents" matches "agent".
// Postgres FTS already stems on its side; this matches that behaviour on
// our JS-side metadata comparisons.
function stem(t: string): string {
  if (t.length <= 4) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("sses")) return t.slice(0, -2);
  if (t.endsWith("es")) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function tokenize(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.toLowerCase()
    .split(/[^a-z0-9.]+/i)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(stem);
}

export function scoreCandidates(
  query: string,
  candidates: CandidateRow[],
  vecScores: Map<string, number>,
  ftsScores: Map<string, number>
): ScoredResult[] {
  const queryLower = query.toLowerCase().trim();
  const queryTokens = tokenize(query);

  const results: ScoredResult[] = candidates.map((c) => {
    const titleLower = (c.title ?? "").toLowerCase();
    const summaryLower = (c.summary ?? "").toLowerCase();
    const bodyLower = (c.body ?? "").toLowerCase();
    const aliasesLower = (c.search_aliases ?? []).map((a) => a.toLowerCase());

    const titleTokens = tokenize(c.title);
    const aliasTokens = (c.search_aliases ?? []).flatMap((a) => tokenize(a));
    const topicTokens = tokenize(c.topic);
    const seriesTokens = tokenize(c.series);
    const useCaseTokens = (c.use_cases ?? []).flatMap((u) => tokenize(u));
    const tagSubtokens = (c.tags ?? []).flatMap((t) => tokenize(t));
    const categoryTokens = tokenize(c.category);

    const varNames = [
      ...(c.required_variables ?? []),
      ...(c.optional_variables ?? []),
    ].map((v) => v.name?.toLowerCase()).filter((n): n is string => !!n);

    // Title signal — graduated: substring > N-token overlap > 1 token > nothing.
    // Within the strong tier (2+ hits), each extra hit adds titleStrongStep so
    // a 4-of-4 title match outscores a 2-of-4 by enough to flip near-ties.
    const titleSubstr = queryLower.length > 0 && titleLower.includes(queryLower);
    const titleHits = queryTokens.filter((qt) => titleTokens.includes(qt)).length;
    const titleBonus = titleSubstr
      ? BONUS.titleSubstring
      : titleHits >= 2
        ? Math.min(BONUS.titleSubstring, BONUS.titleStrong + (titleHits - 2) * BONUS.titleStrongStep)
        : titleHits >= 1
          ? BONUS.titleAny
          : 0;

    // Alias signal — exact match (alias in query, or query contains alias)
    const aliasExact = aliasesLower.some(
      (a) => a.length > 0 && (queryLower === a || queryLower.includes(a))
    );
    // Also catch token-level alias overlap (any alias subtoken in query)
    const aliasAnyToken = aliasTokens.some((at) => queryTokens.includes(at));
    const aliasBonus = aliasExact ? BONUS.aliasExact : (aliasAnyToken ? BONUS.aliasExact * 0.5 : 0);

    // Topic / series — query token overlaps with topic/series tokens
    const topicMatch = topicTokens.length > 0 && queryTokens.some((qt) => topicTokens.includes(qt));
    const seriesMatch = seriesTokens.length > 0 && queryTokens.some((qt) => seriesTokens.includes(qt));

    // Use case — needs 2+ overlapping tokens to be a strong signal
    const useCaseHits = queryTokens.filter((qt) => useCaseTokens.includes(qt)).length;
    const useCaseStrong = useCaseHits >= 2;

    // Tag subtoken — split hyphens so "build-vs-buy" tag matches query token "build"
    const tagMatch = queryTokens.some((qt) => tagSubtokens.includes(qt));

    // Category — query token contained in category
    const categoryMatch = categoryTokens.length > 0 && queryTokens.some((qt) => categoryTokens.includes(qt));

    // Variable names — query contains variable name, or token equals name
    const variableExact = varNames.length > 0 && (
      varNames.some((vn) => queryTokens.includes(vn)) ||
      varNames.some((vn) => queryLower.includes(vn))
    );

    // Summary substring (cheap)
    const summaryPhrase = queryLower.length > 0 && summaryLower.length > 0 && summaryLower.includes(queryLower);

    // Body cheap substring
    const bodyMatch = bodyLower.length > 0 && queryTokens.some((qt) => bodyLower.includes(qt));

    const hasMetadataSignal =
      titleBonus > 0 || aliasBonus > 0 || topicMatch || seriesMatch ||
      useCaseStrong || tagMatch || categoryMatch || summaryPhrase || variableExact;

    const onlyBody = bodyMatch && !hasMetadataSignal;

    // Phase 4 baseline: vec * 0.80 + flat 0.20 FTS bonus on match
    const vecScore = vecScores.get(c.id) ?? 0;
    const ftsMatched = ftsScores.has(c.id);
    const base = vecScore * BASE_VEC + (ftsMatched ? BASE_FTS : 0);

    const bonus =
      titleBonus +
      aliasBonus +
      (seriesMatch    ? BONUS.seriesMatch   : 0) +
      (topicMatch     ? BONUS.topicMatch    : 0) +
      (useCaseStrong  ? BONUS.useCaseStrong : 0) +
      (tagMatch       ? BONUS.tagSubtoken   : 0) +
      (variableExact  ? BONUS.variableExact : 0);

    const penalty = onlyBody ? PENALTY.bodyOnly : 0;

    const score = base + bonus + penalty;

    return {
      id: c.id,
      score,
      matchSignals: {
        title:     titleBonus > 0,
        aliases:   aliasBonus > 0,
        topic:     topicMatch,
        series:    seriesMatch,
        use_cases: useCaseStrong,
        tags:      tagMatch,
        category:  categoryMatch,
        summary:   summaryPhrase,
        variables: variableExact,
        body:      bodyMatch,
        vector:    vecScores.has(c.id),
        fts:       ftsMatched,
      },
    };
  });

  return results.sort((a, b) => b.score - a.score);
}
