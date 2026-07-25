import { type PlayerWithScore } from "@/components/scoring/types";

/**
 * One demo game, shared by every marketing section so the page reads as a
 * single continuous evening rather than four unrelated screenshots.
 *
 * The numbers are load-bearing: `fixtures.test.ts` asserts that the deltas
 * sum to the cumulative scores and that those match the standings. Change one
 * array and you must change the others.
 */

export const DEMO_WIN_THRESHOLD = 75;
export const DEMO_ROUNDS_PLAYED = 4;

export const DEMO_PLAYERS: PlayerWithScore[] = [
  {
    id: "dana",
    name: "Dana",
    color: "#eab308",
    isGuest: false,
    userId: "dana",
    score: 58,
  },
  {
    id: "mike",
    name: "Mike",
    color: "#ef4444",
    isGuest: false,
    userId: "mike",
    score: 44,
  },
  {
    id: "priya",
    name: "Priya",
    color: "#22c55e",
    isGuest: false,
    userId: "priya",
    score: 36,
  },
  {
    id: "tom",
    name: "Tom",
    color: "#3b82f6",
    isGuest: true,
    guestId: "tom",
    score: 21,
  },
];

/** Per-round score change, oldest round first. */
export const DEMO_DELTAS_BY_PLAYER: Record<string, number[]> = {
  dana: [12, 15, 16, 15],
  mike: [9, 12, 12, 11],
  priya: [7, 11, 10, 8],
  tom: [4, 7, 5, 5],
};

/** Running totals after each round — what ScoreProgressionCard plots. */
export const DEMO_SCORES_BY_ROUND: Record<string, number[]> = {
  dana: [12, 27, 43, 58],
  mike: [9, 21, 33, 44],
  priya: [7, 18, 28, 36],
  tom: [4, 11, 16, 21],
};
