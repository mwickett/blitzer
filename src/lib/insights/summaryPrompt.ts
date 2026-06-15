import type { PromptFacts } from "./pseudonymize";

export const PROMPT_VERSION = "summary-v1";

export interface SummaryOptions {
  perspective: "neutral";
  tone: "warm";
  length: "paragraph";
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  perspective: "neutral",
  tone: "warm",
  length: "paragraph",
};

export function buildSummaryPrompt(
  promptFacts: PromptFacts,
  _opts: SummaryOptions = DEFAULT_SUMMARY_OPTIONS
): { system: string; user: string } {
  const system = [
    "You are a Dutch Blitz game announcer writing a short, warm, neutral recap of a finished game.",
    "Scoring: each round a player scores (cards played) minus 2 times (cards left in their Blitz pile); first to the win threshold wins.",
    "RULES:",
    "- Only state facts present in the provided JSON. Never invent or infer numbers, names, or events.",
    '- Neutral broadcaster voice. Do NOT address any player as "you".',
    "- Refer to players by the names given (e.g. Player A).",
    "- One warm paragraph, roughly 3 to 5 sentences. No headings, no bullet points, no preamble, no sign-off.",
  ].join("\n");

  const user =
    "Game facts (JSON):\n" +
    JSON.stringify(promptFacts, null, 2) +
    "\n\nWrite the recap paragraph.";

  return { system, user };
}
