// ============================================================
// Core types for Prompt Library
// ============================================================

export type VariableType = "text" | "long_text" | "choice";

export interface VariableDef {
  name: string;
  type: VariableType;
  required: boolean;
  description?: string;
  options?: string[]; // only for type === 'choice'
  default?: string;   // only for optional variables
}

export interface Prompt {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  required_variables: VariableDef[];
  optional_variables: VariableDef[];
  tags: string[];
  category: string | null;
  topic: string | null;
  series: string | null;
  search_aliases: string[];
  use_cases: string[];
  notes: string | null;
  // embedding is excluded from most queries (large float array)
  created_at: string;
  updated_at: string;
}

// Per-field match flags returned alongside a search result. Drives the
// "matched on: title, aliases, series" hint on result cards (Phase 6).
export interface MatchSignals {
  title: boolean;
  aliases: boolean;
  topic: boolean;
  series: boolean;
  use_cases: boolean;
  tags: boolean;
  category: boolean;
  summary: boolean;
  variables: boolean;
  body: boolean;
  vector: boolean;
  fts: boolean;
}

// Row returned by the search endpoint — includes a score and match signals
export interface SearchResult extends Prompt {
  score: number;
  matchSignals: MatchSignals;
}

export interface PromptVariant {
  id: string;
  parent_id: string;
  title: string | null;
  frozen_body: string;   // parent body at variant creation time
  adapted_body: string;  // the final adapted output (immutable)
  context_used: Record<string, string>;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  snapshot: Prompt; // full prompt row
  changed_at: string;
}

// Payload for creating a prompt
export type CreatePromptPayload = Omit<Prompt, "id" | "created_at" | "updated_at">;

// Payload for updating a prompt (all fields optional except id)
export type UpdatePromptPayload = Partial<CreatePromptPayload>;

// Context provided by the user when adapting a prompt
export interface AdaptContext {
  variables: Record<string, string>; // filled {{variable}} values
  freeform?: string;                 // free-text context for Path B
}
