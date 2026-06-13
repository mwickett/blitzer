import {
  buildSummaryPrompt,
  PROMPT_VERSION,
  DEFAULT_SUMMARY_OPTIONS,
} from "@/lib/insights/summaryPrompt";
import type { PromptFacts } from "@/lib/insights/pseudonymize";

const promptFacts: PromptFacts = {
  winThreshold: 75,
  roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { player: "Player A", total: 80, isWinner: true, rank: 1 },
    { player: "Player B", total: 40, isWinner: false, rank: 2 },
  ],
  winner: "Player A",
  tiebreakUsed: false,
  biggestRound: { delta: 20, player: "Player A", roundNumber: 1 },
  worstRound: { delta: -4, player: "Player B", roundNumber: 2 },
  blitzLeader: { player: "Player A", blitzes: 2 },
  totalBlitzes: 3,
  leadChanges: 1,
};

describe("buildSummaryPrompt", () => {
  it("forbids second-person and invented facts, and embeds the facts", () => {
    const { system, user } = buildSummaryPrompt(
      promptFacts,
      DEFAULT_SUMMARY_OPTIONS
    );
    expect(system.toLowerCase()).toContain("never invent");
    expect(system).toMatch(/do not address.*"you"/i);
    expect(user).toContain("Player A");
    expect(user).toContain('"winner"');
  });

  it("exposes a stable prompt version", () => {
    expect(PROMPT_VERSION).toBe("summary-v1");
  });
});
