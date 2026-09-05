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
    score: 54,
  },
  {
    id: "priya",
    name: "Priya",
    color: "#22c55e",
    isGuest: false,
    userId: "priya",
    score: 42,
  },
  {
    id: "tom",
    name: "Tom",
    color: "#3b82f6",
    isGuest: true,
    guestId: "tom",
    score: 30,
  },
];

/** Per-round score change, oldest round first. */
export const DEMO_DELTAS_BY_PLAYER: Record<string, number[]> = {
  dana: [18, 6, 20, 14],
  mike: [9, 21, 7, 17],
  priya: [14, 3, 16, 9],
  tom: [4, 12, 6, 8],
};

/** Running totals after each round — what ScoreProgressionCard plots. */
export const DEMO_SCORES_BY_ROUND: Record<string, number[]> = {
  dana: [18, 24, 44, 58],
  mike: [9, 30, 37, 54],
  priya: [14, 17, 33, 42],
  tom: [4, 16, 22, 30],
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
  dana: { blitzRemaining: 0, cardsPlayed: 14 }, // 14 − 0  = 14, and Dana blitzed
  mike: { blitzRemaining: 2, cardsPlayed: 21 }, // 21 − 4  = 17
  priya: { blitzRemaining: 1, cardsPlayed: 11 }, // 11 − 2 =  9
  tom: { blitzRemaining: 3, cardsPlayed: 14 }, // 14 − 6   =  8
};
