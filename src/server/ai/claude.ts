import Anthropic from "@anthropic-ai/sdk";

// Mirrors the Prisma singleton pattern in src/server/db/db.ts so hot-reload in
// dev doesn't open a new client per request.
const claudeSingleton = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

declare const globalThis: {
  claudeGlobal: ReturnType<typeof claudeSingleton>;
} & typeof global;

const claude = globalThis.claudeGlobal ?? claudeSingleton();

export default claude;

if (process.env.NODE_ENV !== "production") globalThis.claudeGlobal = claude;

export const CLAUDE_SUMMARY_MODEL = "claude-opus-4-8";

export interface GeneratedText {
  text: string;
  tokensUsed: number;
}

// Single, non-streaming Messages call. Adaptive thinking + low effort: the task
// is short and runs async (latency-insensitive), so we trade a little cost for
// reliably grounded prose. No sampling params (removed on Opus 4.8). Throws on
// refusal or empty output so callers never persist an empty "ready" summary.
export async function generateSummaryText(
  system: string,
  user: string
): Promise<GeneratedText> {
  const res = await claude.messages.create({
    model: CLAUDE_SUMMARY_MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: user }],
  } satisfies Anthropic.MessageCreateParamsNonStreaming);

  if (res.stop_reason === "refusal") {
    throw new Error("Claude refused to generate the summary");
  }

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty summary");
  }

  const u = res.usage;
  const tokensUsed =
    (u?.input_tokens ?? 0) +
    (u?.output_tokens ?? 0) +
    (u?.cache_creation_input_tokens ?? 0) +
    (u?.cache_read_input_tokens ?? 0);

  return { text, tokensUsed };
}
