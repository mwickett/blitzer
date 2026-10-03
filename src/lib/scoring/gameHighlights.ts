/**
 * Deterministic "moments" from a finished game's round-by-round series.
 * Inputs are per-player arrays indexed by round, as built by
 * buildRoundGraphSeries.
 */
export interface HighlightPlayer {
  id: string;
  name: string;
}

export type GameHighlight =
  | { kind: "wire_to_wire"; playerId: string }
  | { kind: "comeback"; playerId: string; deficit: number; roundNumber: number }
  | { kind: "lead_changes"; count: number }
  | { kind: "photo_finish"; playerId: string; margin: number }
  | { kind: "lone_survivor"; playerId: string; roundNumber: number }
  | { kind: "blitz_streak"; playerId: string; length: number };

export const COMEBACK_MIN_DEFICIT = 15;
export const PHOTO_FINISH_MAX_MARGIN = 5;
export const MIN_LEAD_CHANGES = 2;
export const MIN_BLITZ_STREAK = 3;

/** Sole leader after a round, or null when the lead is shared. */
function soleLeader(
  players: HighlightPlayer[],
  scoresByRound: Record<string, number[]>,
  round: number,
): string | null {
  let best = -Infinity;
  let leader: string | null = null;
  for (const p of players) {
    const score = scoresByRound[p.id]?.[round] ?? 0;
    if (score > best) {
      best = score;
      leader = p.id;
    } else if (score === best) {
      leader = null;
    }
  }
  return leader;
}

export function findGameHighlights({
  players,
  winnerId,
  scoresByRound,
  deltasByRound,
  blitzByRound,
}: {
  players: HighlightPlayer[];
  winnerId: string;
  scoresByRound: Record<string, number[]>;
  deltasByRound: Record<string, number[]>;
  blitzByRound: Record<string, (number | null)[]>;
}): GameHighlight[] {
  const roundCount = scoresByRound[winnerId]?.length ?? 0;
  if (roundCount === 0 || players.length < 2) return [];
  const highlights: GameHighlight[] = [];

  // Leadership across rounds (ties break no streak and change no lead).
  const leaders = Array.from({ length: roundCount }, (_, r) =>
    soleLeader(players, scoresByRound, r),
  );
  let leadChanges = 0;
  let previous: string | null = null;
  for (const leader of leaders) {
    if (leader === null) continue;
    if (previous !== null && leader !== previous) leadChanges++;
    previous = leader;
  }

  if (roundCount >= 3 && leaders.every((leader) => leader === winnerId)) {
    highlights.push({ kind: "wire_to_wire", playerId: winnerId });
  }

  let deficit = 0;
  let deficitRound = 0;
  for (let r = 0; r < roundCount; r++) {
    const winnerScore = scoresByRound[winnerId][r];
    const top = Math.max(...players.map((p) => scoresByRound[p.id]?.[r] ?? 0));
    if (top - winnerScore > deficit) {
      deficit = top - winnerScore;
      deficitRound = r + 1;
    }
  }
  if (deficit >= COMEBACK_MIN_DEFICIT) {
    highlights.push({
      kind: "comeback",
      playerId: winnerId,
      deficit,
      roundNumber: deficitRound,
    });
  }

  if (leadChanges >= MIN_LEAD_CHANGES) {
    highlights.push({ kind: "lead_changes", count: leadChanges });
  }

  const finals = players
    .map((p) => scoresByRound[p.id]?.[roundCount - 1] ?? 0)
    .sort((a, b) => b - a);
  const margin = finals[0] - finals[1];
  if (margin <= PHOTO_FINISH_MAX_MARGIN) {
    highlights.push({ kind: "photo_finish", playerId: winnerId, margin });
  }

  // A round where one player scored and everyone else went negative.
  if (players.length >= 3) {
    for (let r = 0; r < roundCount; r++) {
      const positive = players.filter(
        (p) => (deltasByRound[p.id]?.[r] ?? 0) > 0,
      );
      const negative = players.filter(
        (p) => (deltasByRound[p.id]?.[r] ?? 0) < 0,
      );
      if (positive.length === 1 && negative.length === players.length - 1) {
        highlights.push({
          kind: "lone_survivor",
          playerId: positive[0].id,
          roundNumber: r + 1,
        });
        break;
      }
    }
  }

  let bestStreak: { playerId: string; length: number } | null = null;
  for (const p of players) {
    let run = 0;
    for (const left of blitzByRound[p.id] ?? []) {
      run = left === 0 ? run + 1 : 0;
      if (run >= MIN_BLITZ_STREAK && run > (bestStreak?.length ?? 0)) {
        bestStreak = { playerId: p.id, length: run };
      }
    }
  }
  if (bestStreak) highlights.push({ kind: "blitz_streak", ...bestStreak });

  return highlights;
}
