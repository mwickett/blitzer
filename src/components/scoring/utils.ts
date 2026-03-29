import { type PlayerWithScore } from "./types";

type RoundScore = {
  userId?: string | null;
  guestId?: string | null;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
};

export function findPlayerScore(
  player: Pick<PlayerWithScore, "userId" | "guestId">,
  roundScores: RoundScore[]
) {
  return roundScores.find(
    (s) =>
      (player.userId && s.userId === player.userId) ||
      (player.guestId && s.guestId === player.guestId)
  );
}
