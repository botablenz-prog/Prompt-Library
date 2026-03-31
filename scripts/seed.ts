/**
 * Seed script — inserts example prompts with embeddings
 * Run: npm run seed
 */

import { createClient } from "@supabase/supabase-js";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

// Load .env.local manually (tsx doesn't auto-load it)
function loadEnv() {
  try {
    const content = require("fs").readFileSync(".env.local", "utf8");
    for (const line of content.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && !key.startsWith("#") && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {
    // no .env.local — rely on environment
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any;

async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    const { pipeline } = await import("@huggingface/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "fp32",
    });
  }
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

const SEED_PROMPTS = [
  {
    title: "Open Brain Spark",
    summary:
      "Interviews you about your actual work, tools, habits, and pain points, then generates a personalized list of Open Brain use cases you wouldn't have thought of on your own.",
    body: `<role>
You are a workflow analyst who helps people discover how a personal knowledge system fits into their actual life. You don't pitch features. You listen to how someone works, identify where context gets lost, and show them exactly what to capture and why. Be direct, practical, and specific to their situation.
</role>

<context-gathering>
1. Before asking anything, check your memory and conversation history for context about the user's role, tools, workflow, team, and habits. If you find relevant context, confirm it: "Based on what I know about you, you work as [role], use [tools], and your team includes [people]. Is that still accurate? I'll use this to personalize my recommendations." Then only ask about what's missing below.

2. Ask: "Walk me through a typical workday. What tools do you open, what kind of work fills your time, and where do things get messy or repetitive?"
3. Wait for their response.

4. Ask: "When you start a new conversation with an AI, what do you find yourself re-explaining most often? The stuff you wish it just knew already."
5. Wait for their response.

6. Ask: "Think about the last month. What's something you forgot — a decision, a detail from a meeting, something someone told you — that cost you time or quality when you needed it later?"
7. Wait for their response.

8. Ask: "Who are the key people in your work life right now? Direct reports, collaborators, clients, stakeholders — whoever you interact with regularly where remembering context matters."
9. Wait for their response.

10. Once you have their workflow, re-explanation patterns, memory gaps, and key people, move to analysis.
</context-gathering>

<analysis>
Using everything gathered, generate personalized Open Brain use cases across these five patterns:
[... analysis instructions ...]
</analysis>

<output-format>
## Your Open Brain Use Cases
[Formatted output by pattern]
</output-format>

<guardrails>
- Every use case must be specific to their described workflow. No generic examples.
- Do not invent details about their work. Ask one follow-up if needed.
</guardrails>`,
    tags: ["discovery", "onboarding", "workflow", "personal-knowledge"],
    category: "Discovery",
    use_cases: [
      "After setup, when staring at the interface wondering what to type",
      "Re-run every few months as your workflow evolves",
    ],
    notes: `**What you'll get:** A personalized "Your First 20 Captures" list organized by category, plus ongoing use patterns tailored to your specific work.\n\n**Output feeds into:** N/A — standalone discovery tool.`,
    required_variables: [],
    optional_variables: [],
  },
  {
    title: "Weekly Review",
    summary: "Guides you through a structured weekly review to close open loops and plan the next week.",
    body: `You are a productivity coach helping me do my weekly review. Walk me through each section below one at a time. Wait for my response before moving to the next section.

## 1. Capture
Ask me: "What's still floating in your head that isn't written down anywhere? Dump everything — tasks, worries, ideas, things you need to decide."

## 2. Clarify
Review what I shared. For each item, ask me to classify it as: action, someday/maybe, reference, or delete.

## 3. Last week
Ask me: "What did you actually get done last week? What went well, and what didn't?"

## 4. This week
Ask me: "What are the 3 most important things you need to accomplish this week? What would make this week a win?"

## 5. Energy & wellbeing
Ask me: "How's your energy? Anything personal you need to account for in your plan this week?"

## 6. Summary
Summarize everything into a clean weekly plan: wins from last week, open loops captured, top 3 priorities, and any flags you noticed.`,
    tags: ["productivity", "weekly-review", "planning"],
    category: "Productivity",
    use_cases: ["Every Friday or Sunday to close the week and plan the next"],
    notes: "**What you'll get:** A clean weekly plan summary with wins, open loops, priorities, and flags.",
    required_variables: [],
    optional_variables: [],
  },
  {
    title: "Cold Email — Value Proposition",
    summary: "Writes a concise, personalized cold email leading with a specific value prop.",
    body: `Write a cold email to {{recipient_name}} at {{company_name}}.

Context about them: {{recipient_context}}

My value proposition: {{value_proposition}}

Keep it under 100 words. Lead with their problem or a specific observation, not with who I am. End with a low-friction CTA. No fluff, no "I hope this finds you well."`,
    tags: ["email", "sales", "outreach", "copywriting"],
    category: "Sales",
    use_cases: ["Writing personalized cold outreach emails", "Prospecting for new clients"],
    notes: "**What you'll get:** A short, punchy cold email under 100 words.",
    required_variables: [
      { name: "recipient_name", type: "text", required: true, description: "Full name of the recipient" },
      { name: "company_name", type: "text", required: true, description: "Their company name" },
      { name: "value_proposition", type: "long_text", required: true, description: "What you offer and why it matters to them" },
    ],
    optional_variables: [
      { name: "recipient_context", type: "long_text", required: false, description: "Anything you know about them — role, recent news, pain points", default: "" },
    ],
  },
  {
    title: "Code Review — PR Summary",
    summary: "Reviews a pull request and produces a clear, structured summary for the team.",
    body: `Review the following pull request and produce a structured summary.

PR title: {{pr_title}}
PR description: {{pr_description}}

Code diff or key changes:
{{code_diff}}

Produce a summary with these sections:
1. **What this changes** — 2-3 sentences max
2. **Why it was done** — business or technical reason
3. **Risks or edge cases** — anything that could break or needs testing
4. **Suggested follow-ups** — optional improvements or tech debt to note
5. **Verdict** — Approve / Request changes / Needs discussion

Be direct. Use bullet points. Flag anything unclear rather than guessing.`,
    tags: ["code-review", "engineering", "pull-request"],
    category: "Engineering",
    use_cases: ["Summarizing PRs for async review", "Creating PR descriptions from diffs"],
    notes: "**What you'll get:** A structured PR summary with verdict and follow-up flags.",
    required_variables: [
      { name: "pr_title", type: "text", required: true, description: "The PR title" },
      { name: "code_diff", type: "long_text", required: true, description: "The code changes or key diff" },
    ],
    optional_variables: [
      { name: "pr_description", type: "long_text", required: false, description: "Existing PR description, if any", default: "" },
    ],
  },
  {
    title: "Meeting Debrief",
    summary: "Converts raw meeting notes into a clean debrief with decisions, actions, and open questions.",
    body: `Convert the following raw meeting notes into a clean debrief.

Meeting topic: {{meeting_topic}}
Attendees: {{attendees}}

Raw notes:
{{raw_notes}}

Produce:
## Decisions made
[List each decision clearly]

## Action items
[Format: Owner — Task — Due date (if mentioned)]

## Open questions
[Anything unresolved that needs follow-up]

## Context for the record
[1-2 sentences summarizing what this meeting was about and why it happened]

Keep it scannable. Don't pad. If something isn't in the notes, leave the section empty rather than guessing.`,
    tags: ["meetings", "notes", "productivity", "async"],
    category: "Productivity",
    use_cases: [
      "After any meeting to create a permanent record",
      "Sharing meeting outcomes async with people who weren't there",
    ],
    notes: "**What you'll get:** A clean meeting debrief with decisions, action items, and open questions.\n\n**Output feeds into:** Team communication, project trackers, personal notes.",
    required_variables: [
      { name: "meeting_topic", type: "text", required: true, description: "What the meeting was about" },
      { name: "raw_notes", type: "long_text", required: true, description: "Your raw notes from the meeting" },
    ],
    optional_variables: [
      { name: "attendees", type: "text", required: false, description: "Who was in the meeting", default: "" },
    ],
  },
];

async function main() {
  console.log("Seeding prompts...\n");

  for (const prompt of SEED_PROMPTS) {
    const embeddingText = [prompt.title, prompt.summary, prompt.body]
      .filter(Boolean)
      .join(" ");
    const embedding = await embed(embeddingText);

    const { data, error } = await supabase
      .from("prompts")
      .insert({ ...prompt, embedding: JSON.stringify(embedding) })
      .select("id, title")
      .single();

    if (error) {
      console.error(`✗ ${prompt.title}:`, error.message);
    } else {
      console.log(`✓ ${data.title} (${data.id})`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
