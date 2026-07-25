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

/**
 * The raw entry each player would have keyed in for the final round — what
 * ScoreEntryPreview shows on its phone screen.
 *
 * Exactly one player may have `blitzRemaining: 0`. Emptying the Blitz pile is
 * what ends the round, so a screen showing three players at zero depicts a
 * game that cannot happen — and the audience for this page plays the game.
 *
 * Each entry must reproduce that player's final delta through the real
 * scoring formula (cards − 2 × blitz). fixtures.test.ts asserts it.
 */
export const DEMO_LAST_ROUND_ENTRIES: Record<
  string,
  { blitzRemaining: number; cardsPlayed: number }
> = {
  dana: { blitzRemaining: 0, cardsPlayed: 15 }, // 15 − 0  = 15, and Dana blitzed
  mike: { blitzRemaining: 2, cardsPlayed: 15 }, // 15 − 4  = 11
  priya: { blitzRemaining: 1, cardsPlayed: 10 }, // 10 − 2 =  8
  tom: { blitzRemaining: 3, cardsPlayed: 11 }, // 11 − 6   =  5
};
