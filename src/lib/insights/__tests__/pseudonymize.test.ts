import { pseudonymizeRecap, rehydrateNames } from "@/lib/insights/pseudonymize";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts: GameRecapFacts = {
  gameId: "g1",
  organizationId: "o1",
  winThreshold: 75,
  roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "u1", total: 80, isWinner: true, rank: 1 },
    { playerKey: "u2", total: 40, isWinner: false, rank: 2 },
  ],
  winnerKey: "u1",
  tiebreakUsed: false,
  biggestRound: { delta: 20, playerKey: "u1", roundNumber: 1 },
  worstRound: { delta: -4, playerKey: "u2", roundNumber: 2 },
  blitzLeader: { playerKey: "u1", blitzes: 2 },
  totalBlitzes: 3,
  leadChanges: 1,
};

describe("pseudonymizeRecap", () => {
  it("maps players to positional pseudonyms and drops internal ids", () => {
    const { promptFacts, nameMap } = pseudonymizeRecap(facts, {
      u1: "Mike",
      u2: "Sarah",
    });

    expect(promptFacts.winner).toBe("Player A");
    expect(promptFacts.standings[0].player).toBe("Player A");
    expect(promptFacts.standings[1].player).toBe("Player B");
    expect(promptFacts.biggestRound.player).toBe("Player A");
    expect(promptFacts.blitzLeader?.player).toBe("Player A");
    expect(nameMap).toEqual({ "Player A": "Mike", "Player B": "Sarah" });

    const json = JSON.stringify(promptFacts);
    expect(json).not.toContain("Mike");
    expect(json).not.toContain("u1"); // no internal playerKey
    expect(json).not.toContain("g1"); // no gameId
  });
});

describe("rehydrateNames", () => {
  it("restores real names", () => {
    const { nameMap } = pseudonymizeRecap(facts, { u1: "Mike", u2: "Sarah" });
    expect(rehydrateNames("Player A edged out Player B.", nameMap)).toBe(
      "Mike edged out Sarah."
    );
  });

  it("replaces longer pseudonyms first to avoid numeric prefix clobbering", () => {
    const map = { "Player 1": "Ann", "Player 10": "Bob" };
    expect(rehydrateNames("Player 10 beat Player 1.", map)).toBe(
      "Bob beat Ann."
    );
  });
});
