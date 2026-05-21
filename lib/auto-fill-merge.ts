import type { VariableDef } from "@/lib/types";

// Shape of the fields auto-fill can suggest. Matches POST /api/auto-fill
// response. Optional everywhere — auto-fill may return null/[] for fields
// the LLM is not confident about.
export interface AutoFillFields {
  title:              string | null;
  summary:            string | null;
  category:           string | null;
  topic:              string | null;
  series:             string | null;
  tags:               string[];
  search_aliases:     string[];
  use_cases:          string[];
  notes:              string | null;
  required_variables: VariableDef[];
  optional_variables: VariableDef[];
}

function isStringBlank(v: string | null | undefined): boolean {
  return v == null || v.trim().length === 0;
}

function isArrayBlank<T>(v: T[] | null | undefined): boolean {
  return !v || v.length === 0;
}

// Hard product rule: user input always wins. For each field, if the user
// has typed something non-blank, keep their value byte-for-byte; otherwise
// fall back to the LLM suggestion. Never overwrite user input.
//
// "Blank" here means: trimmed-empty string, or empty array. For new prompts
// (the only place this function is called) there is no prior state to
// preserve a deliberate-clear against — a blank field is just blank.
export function mergeAutoFill(user: AutoFillFields, llm: AutoFillFields): AutoFillFields {
  return {
    title:              isStringBlank(user.title)              ? llm.title              : user.title,
    summary:            isStringBlank(user.summary)            ? llm.summary            : user.summary,
    category:           isStringBlank(user.category)           ? llm.category           : user.category,
    topic:              isStringBlank(user.topic)              ? llm.topic              : user.topic,
    series:             isStringBlank(user.series)             ? llm.series             : user.series,
    tags:               isArrayBlank(user.tags)                ? llm.tags               : user.tags,
    search_aliases:     isArrayBlank(user.search_aliases)      ? llm.search_aliases     : user.search_aliases,
    use_cases:          isArrayBlank(user.use_cases)           ? llm.use_cases          : user.use_cases,
    notes:              isStringBlank(user.notes)              ? llm.notes              : user.notes,
    required_variables: isArrayBlank(user.required_variables)  ? llm.required_variables : user.required_variables,
    optional_variables: isArrayBlank(user.optional_variables)  ? llm.optional_variables : user.optional_variables,
  };
}

// Returns true if at least one of the metadata fields the user can fill is
// blank. Used to decide whether to call auto-fill at all on a new-prompt
// save. If everything's filled, skip the LLM call entirely.
export function hasAnyBlankField(user: AutoFillFields): boolean {
  return (
    isStringBlank(user.title) ||
    isStringBlank(user.summary) ||
    isStringBlank(user.category) ||
    isStringBlank(user.topic) ||
    isArrayBlank(user.tags) ||
    isArrayBlank(user.search_aliases) ||
    isArrayBlank(user.use_cases) ||
    isStringBlank(user.notes)
    // series is intentionally not checked: it's null by default for most
    // prompts and that's fine. We only auto-fill series if the LLM is
    // confident the prompt belongs to a named family.
  );
}
