import {
  findUngroundedNumbers,
  collectFactNumbers,
} from "@/lib/insights/grounding";

const facts = {
  winThreshold: 75,
  roundsPlayed: 3,
  standings: [
    { player: "Player A", total: 80, rank: 1 },
    { player: "Player B", total: 40, rank: 2 },
  ],
  totalBlitzes: 3,
};

describe("findUngroundedNumbers", () => {
  it("returns nothing when every number is grounded", () => {
    const text = "Player A reached 80 over 3 rounds, beating 40.";
    expect(findUngroundedNumbers(text, facts)).toEqual([]);
  });

  it("flags a fabricated number", () => {
    const text = "Player A scored a record 999 points.";
    expect(findUngroundedNumbers(text, facts)).toContain("999");
  });

  it("collects fact numbers as strings", () => {
    expect(collectFactNumbers(facts).has("80")).toBe(true);
  });
});
