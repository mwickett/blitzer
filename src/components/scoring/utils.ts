import { type PlayerWithScore } from "./types";

type RoundScore = {
  userId?: string | null;
  guestId?: string | null;
};

export function findPlayerScore<T extends RoundScore>(
  player: Pick<PlayerWithScore, "userId" | "guestId">,
  roundScores: T[]
): T | undefined {
  return roundScores.find(
    (s) =>
      (player.userId && s.userId === player.userId) ||
      (player.guestId && s.guestId === player.guestId)
  );
}
