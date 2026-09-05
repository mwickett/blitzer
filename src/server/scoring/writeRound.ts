import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { getGameCompletion } from "@/lib/gameLogic";
import {
  scoreWriteSchema,
  type SubmittedScore,
} from "@/lib/validation/submissions";
import { assertGameScoringAccess } from "./access";

type Caller = { userId: string; orgId?: string };
type FailureReason =
  "invalid_input" | "round_conflict" | "stale_round" | "game_finished";
const rejected = (reason: FailureReason, message: string) => ({
  ok: false as const,
  reason,
  message,
});
const gameInclude = {
  players: {
    include: { user: true, guestUser: true },
    orderBy: { id: "asc" as const },
  },
  rounds: { include: { scores: true }, orderBy: { round: "asc" as const } },
} satisfies Prisma.GameInclude;

function playerKey(score: { userId?: string | null; guestId?: string | null }) {
  return score.userId ? `user:${score.userId}` : `guest:${score.guestId}`;
}

function scoresMatch(
  stored: {
    userId: string | null;
    guestId: string | null;
    totalCardsPlayed: number;
    blitzPileRemaining: number;
  }[],
  submitted: SubmittedScore[],
) {
  const byPlayer = new Map(stored.map((score) => [playerKey(score), score]));
  return (
    stored.length === submitted.length &&
    submitted.every((score) => {
      const existing = byPlayer.get(playerKey(score));
      return (
        existing?.totalCardsPlayed === score.totalCardsPlayed &&
        existing?.blitzPileRemaining === score.blitzPileRemaining
      );
    })
  );
}

/** The game lock serializes creation, edits, roster changes, and completion. */
export async function writeRound(
  db: PrismaClient,
  caller: Caller,
  input: unknown,
) {
  const parsed = scoreWriteSchema.safeParse(input);
  if (!parsed.success)
    return rejected("invalid_input", parsed.error.issues[0].message);
  const command = parsed.data;

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${command.gameId} FOR UPDATE`;
    const game = await tx.game.findUnique({
      where: { id: command.gameId },
      include: gameInclude,
    });
    assertGameScoringAccess(game, caller);
    const roster = new Set(game.players.map(playerKey));
    if (
      roster.size !== command.scores.length ||
      command.scores.some((score) => !roster.has(playerKey(score)))
    ) {
      return rejected(
        "invalid_input",
        "Scores must match the players in this game.",
      );
    }

    const existing =
      command.kind === "create"
        ? game.rounds.find((round) => round.round === command.roundNumber)
        : game.rounds.find((round) => round.id === command.roundId);

    if (existing && scoresMatch(existing.scores, command.scores)) {
      // Includes retries of the final round and a successful edit whose
      // response was lost. No writes, timestamps, or notifications repeat.
      return { ok: true as const, round: existing, transition: null };
    }
    if (command.kind === "create") {
      if (existing)
        return rejected(
          "round_conflict",
          `Round ${command.roundNumber} was already recorded. Refresh to review its scores.`,
        );
      if (game.isFinished)
        return rejected(
          "game_finished",
          "This game has finished. Edit a recorded round to correct its scores.",
        );
      const nextRound = (game.rounds.at(-1)?.round ?? 0) + 1;
      if (command.roundNumber !== nextRound)
        return rejected(
          "stale_round",
          `The next round is ${nextRound}. Refresh to see the current scores.`,
        );
    } else {
      if (!existing)
        return rejected(
          "stale_round",
          "This round is no longer available. Refresh to see the current scores.",
        );
      if (existing.revision !== command.expectedRevision)
        return rejected(
          "round_conflict",
          "This round changed while you were editing. Review the latest scores before saving again.",
        );
      const storedPlayers = new Set(existing.scores.map(playerKey));
      if (
        existing.scores.length !== roster.size ||
        storedPlayers.size !== roster.size ||
        [...storedPlayers].some((key) => !roster.has(key))
      ) {
        return rejected(
          "invalid_input",
          "This round has incomplete scores and needs to be repaired before editing.",
        );
      }
    }

    const data = command.scores.map((score) => ({
      ...score,
      updatedAt: new Date(),
    }));
    const round =
      command.kind === "create"
        ? await tx.round.create({
            data: {
              gameId: game.id,
              round: command.roundNumber,
              scores: { create: data },
            },
            include: { scores: true },
          })
        : await tx.round.update({
            where: { id: command.roundId },
            data: {
              revision: { increment: 1 },
              scores: {
                updateMany: data.map(({ userId, guestId, ...values }) => ({
                  where: userId ? { userId } : { guestId },
                  data: values,
                })),
              },
            },
            include: { scores: true },
          });
    const rounds = existing
      ? game.rounds.map((saved) => (saved.id === round.id ? round : saved))
      : [...game.rounds, round];
    const completion = getGameCompletion({ ...game, rounds });
    const isFinished = completion.winnerId !== null;
    const transitioned = isFinished !== game.isFinished;
    const endedAt = isFinished ? (game.endedAt ?? new Date()) : null;
    if (
      transitioned ||
      completion.winnerId !== game.winnerId ||
      endedAt?.getTime() !== game.endedAt?.getTime()
    ) {
      await tx.game.update({
        where: { id: game.id },
        data: { isFinished, winnerId: completion.winnerId, endedAt },
      });
    }

    // Snapshot after commit is consumed only by the action's side-effect layer.
    const transition = transitioned
      ? {
          kind: isFinished ? ("finished" as const) : ("reopened" as const),
          gameId: game.id,
          winnerId: completion.winnerId,
          players: game.players,
        }
      : null;
    return { ok: true as const, round, transition };
  });
}
