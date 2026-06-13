import type { GameRecapFacts } from "./gameRecap";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// The LLM-facing projection: pseudonymous players, no internal ids (gameId,
// organizationId, playerKey are all dropped or replaced).
export interface PromptFacts {
  winThreshold: number;
  roundsPlayed: number;
  playerCount: number;
  standings: { player: string; total: number; isWinner: boolean; rank: number }[];
  winner: string | null;
  tiebreakUsed: boolean;
  biggestRound: { delta: number; player: string; roundNumber: number };
  worstRound: { delta: number; player: string; roundNumber: number };
  blitzLeader: { player: string; blitzes: number } | null;
  totalBlitzes: number;
  leadChanges: number;
}

export interface Pseudonymized {
  promptFacts: PromptFacts;
  /** pseudonym -> real display name, for rehydrating the model's output. */
  nameMap: Record<string, string>;
}

// Pseudonyms are assigned by standings order (deterministic) and keyed by
// playerKey — so duplicate display names never collapse, and real names /
// internal ids never reach the model.
export function pseudonymizeRecap(
  facts: GameRecapFacts,
  playerNames: Record<string, string>
): Pseudonymized {
  const keyToPseudo: Record<string, string> = {};
  facts.standings.forEach((s, i) => {
    keyToPseudo[s.playerKey] = `Player ${ALPHABET[i] ?? String(i)}`;
  });
  const px = (key: string | null): string | null =>
    key == null ? null : keyToPseudo[key] ?? key;

  const promptFacts: PromptFacts = {
    winThreshold: facts.winThreshold,
    roundsPlayed: facts.roundsPlayed,
    playerCount: facts.playerCount,
    standings: facts.standings.map((s) => ({
      player: keyToPseudo[s.playerKey] ?? s.playerKey,
      total: s.total,
      isWinner: s.isWinner,
      rank: s.rank,
    })),
    winner: px(facts.winnerKey),
    tiebreakUsed: facts.tiebreakUsed,
    biggestRound: {
      delta: facts.biggestRound.delta,
      player: px(facts.biggestRound.playerKey)!,
      roundNumber: facts.biggestRound.roundNumber,
    },
    worstRound: {
      delta: facts.worstRound.delta,
      player: px(facts.worstRound.playerKey)!,
      roundNumber: facts.worstRound.roundNumber,
    },
    blitzLeader: facts.blitzLeader
      ? { player: px(facts.blitzLeader.playerKey)!, blitzes: facts.blitzLeader.blitzes }
      : null,
    totalBlitzes: facts.totalBlitzes,
    leadChanges: facts.leadChanges,
  };

  const nameMap: Record<string, string> = {};
  for (const [key, pseudo] of Object.entries(keyToPseudo)) {
    nameMap[pseudo] = playerNames[key] ?? key;
  }

  return { promptFacts, nameMap };
}

export function rehydrateNames(
  text: string,
  nameMap: Record<string, string>
): string {
  // Replace longer pseudonyms first so "Player 1" doesn't clobber "Player 10".
  const pairs = Object.entries(nameMap).sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [pseudo, real] of pairs) out = out.split(pseudo).join(real);
  return out;
}
