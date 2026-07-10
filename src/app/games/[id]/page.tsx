import { ScoringShell } from "@/components/scoring/ScoringShell";
import { getGameById, getPredictionProfilesForGame } from "@/server/queries";
import { notFound, redirect } from "next/navigation";
import transformGameData, { GameWithPlayersAndScores } from "@/lib/gameLogic";
import {
  resolvePlayerColor,
  assignColorsToPlayers,
} from "@/lib/scoring/colors";
import { auth } from "@clerk/nextjs/server";

export default async function GameView(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  // Parallelize independent async calls — they don't depend on each other
  const [gameData, { userId, orgId }] = await Promise.all([
    getGameById(params.id),
    auth(),
  ]);

  if (!gameData) {
    notFound();
  }

  // The query layer guarantees this shape — no per-request adaptation needed
  const game: GameWithPlayersAndScores = gameData;

  const isPickupPlayer = !!userId && game.kind === "PICKUP" && game.players.some(
    (player) => player.user?.clerk_user_id === userId
  );
  if (game.kind === "PICKUP" && !game.startedAt) {
    if (isPickupPlayer) redirect(`/games/${game.id}/lobby`);
    notFound();
  }

  const displayScores = transformGameData(game);

  // Completion is synced when scores are written, but a winner can still be
  // derived from the loaded rounds before the snapshot reflects it — trust
  // the computed scores over the isFinished flag we read.
  const isFinished = game.isFinished || displayScores.some((s) => s.isWinner);

  // calculate the current round number
  const currentRoundNumber = game.rounds.length + 1;

  // Resolve accent colors for all players
  const playerColorInputs = game.players.map((p) => ({
    id: p.id,
    resolvedColor: resolvePlayerColor({
      gameColor: p.accentColor ?? null,
      userDefault: p.user?.accentColor ?? null,
    }),
  }));
  const colorAssignments = assignColorsToPlayers(playerColorInputs);

  // Build PlayerWithScore array for the new scoring shell
  // DisplayScores.id is the participant's userId or guestId (stable ID from gameLogic.ts)
  const scoringPlayers = displayScores.map((ds) => {
    const gamePlayer = game.players.find(
      (p) => p.userId === ds.id || p.guestId === ds.id
    );
    return {
      id: ds.id,
      name: ds.username,
      color: colorAssignments[gamePlayer?.id ?? ds.id] ?? "#3b82f6",
      isGuest: ds.isGuest,
      userId: gamePlayer?.userId ?? undefined,
      guestId: gamePlayer?.guestId ?? undefined,
      score: ds.total,
    };
  });
  // Circle members (authenticated + same active circle) can enter scores and
  // edit rounds. Everyone else — non-members, public shared links — gets a
  // read-only spectator view of the same scoring UI.
  const isCircleMember =
    !!userId && !!game.organizationId && game.organizationId === orgId;
  const predictionProfiles = isCircleMember
    ? await getPredictionProfilesForGame(params.id)
    : {};

  return (
    <section className="py-6">
      {game.winThreshold !== 75 && (
        <p className="text-center text-sm text-muted-foreground mb-2">
          Playing to {game.winThreshold} points
        </p>
      )}
      <ScoringShell
        gameId={game.id}
        currentRoundNumber={currentRoundNumber}
        players={scoringPlayers}
        winThreshold={game.winThreshold}
        isFinished={isFinished}
        winnerId={displayScores.find((s) => s.isWinner)?.id}
        endedAt={game.endedAt?.toISOString()}
        canEdit={isCircleMember || isPickupPlayer}
        predictionProfiles={predictionProfiles}
        rounds={game.rounds.map((r) => ({
          id: r.id,
          scores: r.scores.map((s) => ({
            userId: s.userId,
            guestId: s.guestId,
            blitzPileRemaining: s.blitzPileRemaining,
            totalCardsPlayed: s.totalCardsPlayed,
          })),
        }))}
      />
    </section>
  );
}
