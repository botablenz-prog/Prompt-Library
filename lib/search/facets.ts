import { createAnonClient } from "@/lib/supabase/anon";

export interface FacetCount {
  name: string;
  count: number;
}

export interface Facets {
  topics: FacetCount[];
  categories: FacetCount[];
  series: FacetCount[];
  withVarsCount: number;
  totalCount: number;
}

export async function getFacets(): Promise<Facets> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("prompts")
    .select("topic, category, series, required_variables, optional_variables");

  type Row = {
    topic: string | null;
    category: string | null;
    series: string | null;
    required_variables: unknown[] | null;
    optional_variables: unknown[] | null;
  };

  const rows = (data ?? []) as Row[];

  const aggregate = (key: "topic" | "category" | "series"): FacetCount[] => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r[key];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  };

  const withVarsCount = rows.filter(
    (r) => (r.required_variables?.length ?? 0) + (r.optional_variables?.length ?? 0) > 0
  ).length;

  return {
    topics: aggregate("topic"),
    categories: aggregate("category"),
    series: aggregate("series"),
    withVarsCount,
    totalCount: rows.length,
  };
}

export interface SearchFilters {
  topic?: string;
  category?: string;
  series?: string;
  hasVars?: boolean;
}

// Applies filters to a list of prompt rows. Returns only rows that match
// every active filter (AND semantics).
export function applyFilters<T extends {
  topic?: string | null;
  category?: string | null;
  series?: string | null;
  required_variables?: unknown[] | null;
  optional_variables?: unknown[] | null;
}>(rows: T[], filters: SearchFilters): T[] {
  return rows.filter((r) => {
    if (filters.topic && r.topic !== filters.topic) return false;
    if (filters.category && r.category !== filters.category) return false;
    if (filters.series && r.series !== filters.series) return false;
    if (filters.hasVars) {
      const varCount = (r.required_variables?.length ?? 0) + (r.optional_variables?.length ?? 0);
      if (varCount === 0) return false;
    }
    return true;
  });
}
