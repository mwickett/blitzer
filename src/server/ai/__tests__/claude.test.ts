jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create: jest.fn() };
  },
}));

import claude, {
  generateSummaryText,
  CLAUDE_SUMMARY_MODEL,
} from "@/server/ai/claude";

// The default export is the singleton instance, so its mocked create() is the
// one generateSummaryText calls.
const create = claude.messages.create as jest.Mock;

describe("generateSummaryText", () => {
  beforeEach(() => create.mockReset());

  it("calls Claude with the summary model and sums all billed tokens", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "A close " },
        { type: "thinking", thinking: "..." },
        { type: "text", text: "game." },
      ],
      usage: {
        input_tokens: 30,
        output_tokens: 12,
        cache_creation_input_tokens: 5,
        cache_read_input_tokens: 3,
      },
    });

    const result = await generateSummaryText("SYSTEM", "USER");

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(CLAUDE_SUMMARY_MODEL);
    expect(CLAUDE_SUMMARY_MODEL).toBe("claude-opus-4-8");
    expect(result.text).toBe("A close game.");
    expect(result.tokensUsed).toBe(50);
  });

  it("throws on a refusal stop reason", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [], usage: {} });
    await expect(generateSummaryText("S", "U")).rejects.toThrow(/refus/i);
  });

  it("throws when the model returns only whitespace", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "   " }],
      usage: {},
    });
    await expect(generateSummaryText("S", "U")).rejects.toThrow(/empty/i);
  });
});
