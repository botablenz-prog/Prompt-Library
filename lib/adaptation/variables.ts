import type { VariableDef } from "@/lib/types";

// Extract all {{variable_name}} placeholders from a prompt body
export function extractVariableNames(body: string): string[] {
  const matches = body.matchAll(/\{\{(\w+)\}\}/g);
  const names = new Set<string>();
  for (const match of matches) {
    names.add(match[1]);
  }
  return Array.from(names);
}

// Given the variable definitions and a context map, return which required
// variables are still missing (not provided or empty)
export function detectMissing(
  required: VariableDef[],
  context: Record<string, string>
): VariableDef[] {
  return required.filter(
    (v) => !context[v.name] || context[v.name].trim() === ""
  );
}

// Simple string interpolation — replaces {{name}} with context[name]
// Leaves unfilled placeholders as-is if not in context
export function interpolate(
  body: string,
  context: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return context[name] !== undefined ? context[name] : match;
  });
}

// Returns true if the body still has unfilled {{...}} after interpolation
export function hasUnfilledVariables(interpolated: string): boolean {
  return /\{\{\w+\}\}/.test(interpolated);
}
